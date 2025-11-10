"""Email account management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.email_account import EmailAccount
from app.db.models.user_settings import UserSettings
from app.db.base import get_db
from app.services.user_settings_service import (
    get_or_create_user_settings
)

# Ensure .env is loaded when this module is imported
BACKEND_DIR = Path(__file__).parent.parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=True)

logger = logging.getLogger(__name__)

router = APIRouter()


class EmailAccountCreateRequest(BaseModel):
    email: EmailStr
    provider: str  # 'gmail', 'outlook', 'custom'
    display_name: Optional[str] = None
    
    # For OAuth providers
    refresh_token: Optional[str] = None
    access_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    
    # For custom SMTP
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None


class EmailAccountUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None


class OAuthCallbackRequest(BaseModel):
    provider: str  # 'gmail' or 'outlook'
    code: str
    state: Optional[str] = None


@router.get("/email-accounts")
async def list_email_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """List the active email account for the current user (only one account shown based on user_settings)."""
    try:
        # Get user settings to find active email account
        user_settings = await get_or_create_user_settings(current_user.id, db)
        
        accounts = []
        
        # If user has an active email account set, return only that one
        if user_settings.active_email_account_id:
            result = await db.execute(
                select(EmailAccount)
                .where(EmailAccount.id == user_settings.active_email_account_id)
                .where(EmailAccount.owner_id == current_user.id)
            )
            active_account = result.scalar_one_or_none()
            
            if active_account:
                accounts = [active_account]
            else:
                # Active account ID doesn't exist or doesn't belong to user - clear it
                logger.warning(f"Active email account {user_settings.active_email_account_id} not found for user {current_user.id}, clearing it")
                user_settings.active_email_account_id = None
                await db.commit()
        
        # If no active account set, check if user has any email accounts and set the first one as active
        if not accounts:
            result = await db.execute(
                select(EmailAccount)
                .where(EmailAccount.owner_id == current_user.id)
                .order_by(EmailAccount.created_at.desc())
            )
            all_accounts = result.scalars().all()
            
            if all_accounts:
                # Set the most recent account as active
                first_account = all_accounts[0]
                
                if len(all_accounts) > 1:
                    accounts_to_delete = [acc.id for acc in all_accounts[1:]]
                    if accounts_to_delete:
                        await db.execute(
                            delete(EmailAccount)
                            .where(EmailAccount.id.in_(accounts_to_delete))
                            .where(EmailAccount.owner_id == current_user.id)
                        )
                        logger.warning(
                            f"User {current_user.id} had {len(all_accounts)} email accounts. "
                            f"Keeping most recent ({first_account.email}) and deleting {len(accounts_to_delete)} duplicates."
                        )
                        await db.flush()
                
                user_settings.active_email_account_id = first_account.id
                await db.commit()
                accounts = [first_account]
        
        return {
            "accounts": [
                {
                    "id": acc.id,
                    "email": acc.email,
                    "provider": acc.provider,
                    "display_name": acc.display_name,
                    "is_active": True,  # Always true since it's the active account
                    "is_default": True,  # Always true since it's the only one shown
                    "created_at": acc.created_at.isoformat(),
                    "last_used_at": acc.last_used_at.isoformat() if acc.last_used_at else None,
                }
                for acc in accounts
            ]
        }
    except Exception as e:
        logger.error(f"Error listing email accounts: {str(e)}")
        # If table doesn't exist, return empty list instead of crashing
        return {"accounts": []}


@router.post("/email-accounts")
async def create_email_account(
    request: EmailAccountCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Create a new email account."""
    
    # Validate provider
    if request.provider not in ['gmail', 'outlook', 'custom']:
        raise HTTPException(status_code=400, detail="Provider must be 'gmail', 'outlook', or 'custom'")
    
    # Validate OAuth vs SMTP credentials
    if request.provider in ['gmail', 'outlook']:
        if not request.refresh_token and not request.access_token:
            raise HTTPException(status_code=400, detail=f"{request.provider.capitalize()} requires OAuth credentials")
    elif request.provider == 'custom':
        if not request.smtp_server or not request.smtp_username or not request.smtp_password:
            raise HTTPException(status_code=400, detail="Custom provider requires SMTP credentials")
    
    # Get user settings
    user_settings = await get_or_create_user_settings(current_user.id, db)
    
    # Get all existing email accounts for this user
    existing_result = await db.execute(
        select(EmailAccount).where(EmailAccount.owner_id == current_user.id)
    )
    existing_accounts = existing_result.scalars().all()
    
    matching_account = None
    for account in existing_accounts:
        if account.email and account.email.lower() == request.email.lower():
            matching_account = account
            break
    
    if matching_account:
        # Update existing account (same email) instead of creating duplicate
        matching_account.provider = request.provider
        matching_account.display_name = request.display_name or request.email.split('@')[0]
        matching_account.refresh_token = request.refresh_token or matching_account.refresh_token
        matching_account.access_token = request.access_token or matching_account.access_token
        matching_account.token_expires_at = request.token_expires_at or matching_account.token_expires_at
        matching_account.smtp_server = request.smtp_server or matching_account.smtp_server
        matching_account.smtp_port = str(request.smtp_port) if request.smtp_port is not None else matching_account.smtp_port
        matching_account.smtp_username = request.smtp_username or matching_account.smtp_username
        matching_account.smtp_password = request.smtp_password or matching_account.smtp_password
        matching_account.is_active = True
        matching_account.is_default = True
        matching_account.updated_at = datetime.utcnow()
        
        user_settings.active_email_account_id = matching_account.id
        user_settings.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(matching_account)
        email_account = matching_account
    elif existing_accounts:
        # User already has a different email account connected
        existing = existing_accounts[0]
        logger.info(
            f"User {current_user.id} attempted to add a new email account ({request.email}) "
            f"while already connected to {existing.email}. Rejecting request."
        )
        raise HTTPException(
            status_code=400,
            detail="You already have an email account connected. Please delete your current account first if you want to connect a different one."
        )
    else:
        # Create new email account (only one allowed per user)
        email_account = EmailAccount(
            owner_id=current_user.id,
            email=request.email,
            provider=request.provider,
            display_name=request.display_name or request.email.split('@')[0],
            refresh_token=request.refresh_token,
            access_token=request.access_token,
            token_expires_at=request.token_expires_at,
            smtp_server=request.smtp_server,
            smtp_port=str(request.smtp_port) if request.smtp_port is not None else None,
            smtp_username=request.smtp_username,
            smtp_password=request.smtp_password,  # TODO: Encrypt this
            is_default=True,
            is_active=True,
        )
        
        db.add(email_account)
        await db.flush()  # Get the ID
        
        # Set this account as active in user_settings
        user_settings.active_email_account_id = email_account.id
        user_settings.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(email_account)
    
    return {
        "id": email_account.id,
        "email": email_account.email,
        "provider": email_account.provider,
        "display_name": email_account.display_name,
        "is_default": email_account.is_default,
        "created_at": email_account.created_at.isoformat(),
    }


@router.put("/email-accounts/{account_id}")
async def update_email_account(
    account_id: int,
    request: EmailAccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Update an email account."""
    
    # Get account
    result = await db.execute(
        select(EmailAccount)
        .where(EmailAccount.id == account_id)
        .where(EmailAccount.owner_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    # Only allow updating metadata / SMTP credentials (no enable/disable toggles)
    update_data = {
        "updated_at": datetime.utcnow()
    }
    
    if request.display_name is not None:
        update_data["display_name"] = request.display_name
    if request.smtp_server is not None:
        update_data["smtp_server"] = request.smtp_server
    if request.smtp_port is not None:
        update_data["smtp_port"] = str(request.smtp_port)
    if request.smtp_username is not None:
        update_data["smtp_username"] = request.smtp_username
    if request.smtp_password is not None:
        update_data["smtp_password"] = request.smtp_password  # TODO: Encrypt this
    
    # Always ensure the account remains marked as active/default since only one is allowed
    update_data["is_active"] = True
    update_data["is_default"] = True
    
    await db.execute(
        update(EmailAccount)
        .where(EmailAccount.id == account_id)
        .values(**update_data)
    )
    await db.commit()
    
    # Refresh and return
    await db.refresh(account)
    return {
        "id": account.id,
        "email": account.email,
        "provider": account.provider,
        "display_name": account.display_name,
        "is_active": account.is_active,
        "is_default": account.is_default,
    }


@router.delete("/email-accounts/{account_id}")
async def delete_email_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Delete an email account."""
    
    result = await db.execute(
        select(EmailAccount)
        .where(EmailAccount.id == account_id)
        .where(EmailAccount.owner_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    # Clear active account from user_settings if this was the active account
    user_settings = await get_or_create_user_settings(current_user.id, db)
    if user_settings.active_email_account_id == account_id:
        user_settings.active_email_account_id = None
        user_settings.updated_at = datetime.utcnow()
        logger.info(f"Cleared active email account for user {current_user.id} after deleting account {account_id}")
    
    await db.execute(
        delete(EmailAccount).where(EmailAccount.id == account_id).where(EmailAccount.owner_id == current_user.id)
    )
    await db.commit()
    
    return {"message": "Email account deleted successfully"}


@router.get("/email-accounts/oauth/{provider}/auth-url")
async def get_oauth_auth_url(
    provider: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get OAuth authorization URL for Gmail or Outlook."""
    
    if provider not in ['gmail', 'outlook']:
        raise HTTPException(status_code=400, detail="Provider must be 'gmail' or 'outlook'")
    
    # Get OAuth config from environment
    from urllib.parse import urlencode
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    
    # Generate state token (in production, use a secure random token)
    import secrets
    state = secrets.token_urlsafe(32)
    
    if provider == 'gmail':
        # Google OAuth - get from environment
        client_id = os.getenv('GOOGLE_CLIENT_ID') or os.environ.get('GOOGLE_CLIENT_ID')
        if not client_id:
            raise HTTPException(status_code=500, detail="Google OAuth not configured (GOOGLE_CLIENT_ID missing)")
        
        # Ensure no trailing slash in redirect URI
        redirect_uri = f"{backend_url.rstrip('/')}/api/v1/email-accounts/oauth/gmail/callback"
        # Request both Gmail send permission and user email/profile info
        scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
        
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        
    elif provider == 'outlook':
        # Microsoft OAuth
        client_id = os.getenv('MICROSOFT_CLIENT_ID')
        if not client_id:
            raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
        
        redirect_uri = f"{backend_url}/api/v1/email-accounts/oauth/outlook/callback"
        scope = "https://graph.microsoft.com/Mail.Send offline_access"
        
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "state": state,
        }
        
        auth_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urlencode(params)}"
    
    # TODO: Store state token in session/cache for validation
    
    return {
        "auth_url": auth_url,
        "state": state,
    }


@router.get("/email-accounts/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    request: Request = None,
):
    """Handle OAuth callback and redirect to frontend."""
    
    import os
    from fastapi.responses import RedirectResponse
    from urllib.parse import urlencode
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    if error:
        # OAuth error - redirect to frontend with error
        error_msg = urlencode({"error": error, "provider": provider})
        return RedirectResponse(url=f"{frontend_url}/settings/email-accounts/oauth-callback?{error_msg}")
    
    if not code:
        # No code - redirect with error
        error_msg = urlencode({"error": "No authorization code received", "provider": provider})
        return RedirectResponse(url=f"{frontend_url}/settings/email-accounts/oauth-callback?{error_msg}")
    
    if provider not in ['gmail', 'outlook']:
        error_msg = urlencode({"error": "Invalid provider", "provider": provider})
        return RedirectResponse(url=f"{frontend_url}/settings/email-accounts/oauth-callback?{error_msg}")
    
    # Redirect to frontend with code and state
    # Frontend will exchange these for tokens and create account
    params = urlencode({
        "code": code.strip() if code else code,
        "state": (state or "").strip(),
        "provider": provider
    })
    return RedirectResponse(url=f"{frontend_url}/settings/email-accounts/oauth-callback?{params}")


@router.post("/email-accounts/oauth/complete")
async def complete_oauth_setup(
    request: OAuthCallbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Complete OAuth setup by exchanging code for tokens and creating email account."""
    
    print(f"[OAUTH DEBUG] Received OAuth complete request - provider: {request.provider}, code length: {len(request.code) if request.code else 0}")
    
    if request.provider not in ['gmail', 'outlook']:
        print(f"[OAUTH DEBUG] Invalid provider: {request.provider}")
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    import httpx
    
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    
    try:
        if request.provider == 'gmail':
            # Exchange code for tokens
            # Try multiple ways to get env vars
            client_id = os.getenv('GOOGLE_CLIENT_ID') or os.environ.get('GOOGLE_CLIENT_ID')
            client_secret = os.getenv('GOOGLE_CLIENT_SECRET') or os.environ.get('GOOGLE_CLIENT_SECRET')
            
            if not client_id:
                logger.error("GOOGLE_CLIENT_ID not found in environment")
                raise HTTPException(status_code=500, detail="Google OAuth not configured (GOOGLE_CLIENT_ID missing)")
            if not client_secret:
                logger.error("GOOGLE_CLIENT_SECRET not found in environment")
                raise HTTPException(status_code=500, detail="Google OAuth not configured (GOOGLE_CLIENT_SECRET missing)")
            
            # Ensure redirect_uri matches exactly what was used in authorization
            redirect_uri = f"{backend_url.rstrip('/')}/api/v1/email-accounts/oauth/gmail/callback"
            
            # Strip any whitespace from credentials
            client_id = client_id.strip()
            client_secret = client_secret.strip()
            
            # Ensure code doesn't have any issues
            auth_code = request.code.strip() if request.code else request.code
            if not auth_code:
                raise HTTPException(status_code=400, detail="Authorization code is required")
            
            token_data = {
                "code": auth_code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            
            # Debug logging (don't log secrets in production!)
            print(f"[OAUTH DEBUG] Starting token exchange...")
            print(f"[OAUTH DEBUG] redirect_uri: {redirect_uri}")
            print(f"[OAUTH DEBUG] client_id: {client_id[:20]}...")
            print(f"[OAUTH DEBUG] code length: {len(auth_code)}")
            print(f"[OAUTH DEBUG] code starts with: {auth_code[:10]}...")
            logger.info(f"OAuth token exchange - redirect_uri: {redirect_uri}")
            logger.info(f"OAuth token exchange - client_id: {client_id[:20]}...")
            logger.info(f"OAuth token exchange - code length: {len(auth_code)}")
            logger.info(f"OAuth token exchange - code starts with: {auth_code[:10]}...")
            
            async with httpx.AsyncClient() as http_client:
                # Note: httpx automatically sets Content-Type to application/x-www-form-urlencoded for data parameter
                # Don't override it - let httpx handle it
                try:
                    response = await http_client.post(
                        "https://oauth2.googleapis.com/token",
                        data=token_data,
                        timeout=30.0
                    )
                except Exception as e:
                    logger.error(f"HTTP request failed: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"Failed to connect to Google OAuth: {str(e)}")
                
                # Log response status
                print(f"[OAUTH DEBUG] Token exchange response status: {response.status_code}")
                logger.info(f"Token exchange response status: {response.status_code}")
                
                # Better error handling
                if response.status_code != 200:
                    try:
                        error_data = response.json()
                        print(f"[OAUTH DEBUG] Token exchange error response: {error_data}")
                        logger.error(f"Token exchange error response: {error_data}")
                    except:
                        error_data = {"error": response.text}
                        logger.error(f"Token exchange error (non-JSON): {response.text}")
                    
                    error_msg = error_data.get("error", error_data)
                    if isinstance(error_msg, dict):
                        error_msg = error_msg.get("message", str(error_msg))
                    elif isinstance(error_data, dict) and "error" in error_data:
                        if isinstance(error_data["error"], dict):
                            error_msg = error_data["error"].get("message", str(error_data["error"]))
                        else:
                            error_msg = str(error_data["error"])
                    
                    # More helpful error message
                    if "401" in str(error_msg) or "UNAUTHENTICATED" in str(error_msg):
                        raise HTTPException(
                            status_code=400,
                            detail=f"OAuth token exchange failed. This usually means the client ID/secret are incorrect, the redirect URI doesn't match, or the authorization code was already used/expired. Please try the OAuth flow again from the beginning. Error: {error_msg}"
                        )
                    
                    raise HTTPException(
                        status_code=400,
                        detail=f"OAuth token exchange failed: {error_msg}"
                    )
                
                tokens = response.json()
                print(f"[OAUTH DEBUG] Token exchange successful! Got tokens")
                logger.info("Token exchange successful")
            
            # Get user email from Google API
            access_token = tokens['access_token']
            print(f"[OAUTH DEBUG] Getting user info from Google...")
            print(f"[OAUTH DEBUG] Access token starts with: {access_token[:20]}...")
            
            # Get user email using userinfo endpoint (now we have userinfo.email scope)
            async with httpx.AsyncClient() as client:
                try:
                    user_info = await client.get(
                        "https://www.googleapis.com/oauth2/v2/userinfo",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    print(f"[OAUTH DEBUG] User info response status: {user_info.status_code}")
                    
                    if user_info.status_code != 200:
                        error_text = user_info.text if hasattr(user_info, 'text') else str(user_info)
                        print(f"[OAUTH DEBUG] User info error response: {error_text}")
                        raise HTTPException(
                            status_code=400,
                            detail=f"Failed to retrieve email from Google. Status: {user_info.status_code}"
                        )
                    
                    user_info.raise_for_status()
                    email_data = user_info.json()
                    print(f"[OAUTH DEBUG] Got user info: {email_data.get('email', 'NO EMAIL')}")
                    
                    email = email_data.get('email')
                    if not email:
                        print(f"[OAUTH DEBUG] ERROR: No email in user data: {email_data}")
                        raise HTTPException(
                            status_code=400,
                            detail="Could not retrieve email from Google account"
                        )
                        
                except HTTPException:
                    raise
                except Exception as e:
                    print(f"[OAUTH DEBUG] Error getting user info: {str(e)}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to retrieve email from Google account: {str(e)}"
                    )
            
            print(f"[OAUTH DEBUG] Email extracted: {email}")
            refresh_token = tokens.get('refresh_token')
            expires_in = tokens.get('expires_in', 3600)
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
            print(f"[OAUTH DEBUG] About to create/update email account in database...")
            
        elif request.provider == 'outlook':
            # Exchange code for tokens
            client_id = os.getenv('MICROSOFT_CLIENT_ID')
            client_secret = os.getenv('MICROSOFT_CLIENT_SECRET')
            if not client_id or not client_secret:
                raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
            
            redirect_uri = f"{backend_url}/api/v1/email-accounts/oauth/outlook/callback"
            
            token_data = {
                "code": request.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                    data=token_data
                )
                response.raise_for_status()
                tokens = response.json()
            
            # Get user email from Microsoft Graph
            access_token = tokens['access_token']
            async with httpx.AsyncClient() as client:
                user_info = await client.get(
                    "https://graph.microsoft.com/v1.0/me",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                user_info.raise_for_status()
                email_data = user_info.json()
            
            email = email_data.get('mail') or email_data.get('userPrincipalName')
            refresh_token = tokens.get('refresh_token')
            expires_in = tokens.get('expires_in', 3600)
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
        
        # Get user settings
        user_settings = await get_or_create_user_settings(current_user.id, db)
        
        # Check for existing accounts
        existing_result = await db.execute(
            select(EmailAccount).where(EmailAccount.owner_id == current_user.id)
        )
        existing_accounts = existing_result.scalars().all()
        
        matching_account = None
        for account in existing_accounts:
            if account.email and account.email.lower() == email.lower():
                matching_account = account
                break
        
        if matching_account:
            # Update credentials for the same email account
            print(f"[OAUTH DEBUG] Found existing email account {matching_account.id} for email: {email}, updating it")
            logger.info(f"Updating existing email account {matching_account.id} for user {current_user.id}, email: {email}")
            
            matching_account.provider = request.provider
            matching_account.display_name = email.split('@')[0]
            matching_account.refresh_token = refresh_token
            matching_account.access_token = access_token
            matching_account.token_expires_at = token_expires_at
            matching_account.is_active = True
            matching_account.is_default = True
            matching_account.updated_at = datetime.utcnow()
            
            user_settings.active_email_account_id = matching_account.id
            user_settings.updated_at = datetime.utcnow()
            
            await db.commit()
            print(f"[OAUTH DEBUG] Account updated successfully")
            await db.refresh(matching_account)
            email_account = matching_account
        elif existing_accounts:
            # Another email account is already connected
            existing = existing_accounts[0]
            logger.info(
                f"User {current_user.id} attempted to connect a new email account ({email}) "
                f"while already connected to {existing.email}. Rejecting request."
            )
            raise HTTPException(
                status_code=400,
                detail="You already have an email account connected. Please delete your current account first if you want to connect a different one."
            )
        else:
            # No existing accounts - create new
            print(f"[OAUTH DEBUG] No existing account found for email: {email}, creating new one")
            logger.info(f"Creating new email account for user {current_user.id}, email: {email}")
            
            email_account = EmailAccount(
                owner_id=current_user.id,
                email=email,
                provider=request.provider,
                display_name=email.split('@')[0],
                refresh_token=refresh_token,
                access_token=access_token,
                token_expires_at=token_expires_at,
                is_default=True,
                is_active=True,
            )
            
            db.add(email_account)
            await db.flush()
            
            user_settings.active_email_account_id = email_account.id
            user_settings.updated_at = datetime.utcnow()
            
            await db.commit()
            print(f"[OAUTH DEBUG] Account created successfully")
            await db.refresh(email_account)
        
        return {
            "success": True,
            "message": "Email account connected successfully",
            "account": {
                "id": email_account.id,
                "email": email_account.email,
                "provider": email_account.provider,
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except httpx.HTTPStatusError as e:
        try:
            error_detail = e.response.json() if e.response else str(e)
        except:
            error_detail = e.response.text if hasattr(e, 'response') else str(e)
        raise HTTPException(status_code=400, detail=f"OAuth token exchange failed: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth setup failed: {str(e)}")


@router.post("/email-accounts/cleanup-duplicates")
async def cleanup_duplicate_email_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Remove duplicate email accounts for the current user.
    Keeps the oldest account for each email+provider combination.
    """
    try:
        # Get all accounts for this user
        result = await db.execute(
            select(EmailAccount)
            .where(EmailAccount.owner_id == current_user.id)
            .order_by(EmailAccount.created_at.asc())
        )
        all_accounts = result.scalars().all()
        
        # Group by email+provider (case-insensitive email)
        accounts_by_key = {}
        duplicates_to_delete = []
        
        for account in all_accounts:
            # Use lowercase email for comparison
            key = (account.email.lower() if account.email else "", account.provider)
            
            if key in accounts_by_key:
                # This is a duplicate - mark for deletion
                duplicates_to_delete.append(account.id)
            else:
                # First occurrence - keep it
                accounts_by_key[key] = account
        
        # Delete duplicates
        if duplicates_to_delete:
            await db.execute(
                delete(EmailAccount)
                .where(EmailAccount.id.in_(duplicates_to_delete))
                .where(EmailAccount.owner_id == current_user.id)
            )
            await db.commit()
            
            logger.info(f"Removed {len(duplicates_to_delete)} duplicate email accounts for user {current_user.id}")
            
            return {
                "success": True,
                "removed": len(duplicates_to_delete),
                "kept": len(accounts_by_key),
                "message": f"Removed {len(duplicates_to_delete)} duplicate account(s)"
            }
        else:
            return {
                "success": True,
                "removed": 0,
                "kept": len(accounts_by_key),
                "message": "No duplicates found"
            }
            
    except Exception as e:
        logger.error(f"Error cleaning up duplicates: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup duplicates: {str(e)}"
        )


@router.get("/email-accounts/default")
async def get_default_email_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get the default email account for the user."""
    
    result = await db.execute(
        select(EmailAccount)
        .where(EmailAccount.owner_id == current_user.id)
        .where(EmailAccount.is_default == True)
        .where(EmailAccount.is_active == True)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        # Try to get any active account
        result = await db.execute(
            select(EmailAccount)
            .where(EmailAccount.owner_id == current_user.id)
            .where(EmailAccount.is_active == True)
            .order_by(EmailAccount.created_at.desc())
            .limit(1)
        )
        account = result.scalar_one_or_none()
    
    if not account:
        return {"account": None}
    
    return {
        "account": {
            "id": account.id,
            "email": account.email,
            "provider": account.provider,
            "display_name": account.display_name,
        }
    }

