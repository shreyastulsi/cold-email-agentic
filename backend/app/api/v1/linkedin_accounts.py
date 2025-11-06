"""LinkedIn account management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, text
from datetime import datetime, timedelta
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.linkedin_account import LinkedInAccount
from app.db.base import get_db

# Ensure .env is loaded when this module is imported
BACKEND_DIR = Path(__file__).parent.parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=True)

logger = logging.getLogger(__name__)

router = APIRouter()


class OAuthCallbackRequest(BaseModel):
    provider: str  # 'linkedin'
    code: str
    state: Optional[str] = None


@router.get("/linkedin-accounts")
async def list_linkedin_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """List all LinkedIn accounts for the current user."""
    try:
        # First, verify table exists with a raw query
        from sqlalchemy import text
        try:
            check_result = await db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'linkedin_accounts'
                )
            """))
            table_exists = check_result.scalar()
            if not table_exists:
                logger.error("linkedin_accounts table does not exist in database")
                return {"accounts": [], "error": "Table not found. Please run migrations."}
        except Exception as check_error:
            logger.error(f"Error checking table existence: {check_error}")
        
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.owner_id == current_user.id)
            .order_by(LinkedInAccount.is_default.desc(), LinkedInAccount.created_at.desc())
        )
        accounts = result.scalars().all()
        
        return {
            "accounts": [
                {
                    "id": acc.id,
                    "linkedin_profile_url": acc.linkedin_profile_url,
                    "profile_id": acc.profile_id,
                    "display_name": acc.display_name,
                    "is_active": acc.is_active,
                    "is_default": acc.is_default,
                    "created_at": acc.created_at.isoformat(),
                    "last_used_at": acc.last_used_at.isoformat() if acc.last_used_at else None,
                }
                for acc in accounts
            ]
        }
    except Exception as e:
        logger.error(f"Error listing LinkedIn accounts: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        # Return empty list but log the full error
        return {"accounts": [], "debug_error": str(e)}


@router.get("/linkedin-accounts/oauth/auth-url")
async def get_linkedin_oauth_auth_url(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get LinkedIn OAuth authorization URL."""
    
    from urllib.parse import urlencode
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    
    # Generate state token
    import secrets
    state = secrets.token_urlsafe(32)
    
    # LinkedIn OAuth credentials
    client_id = os.getenv('LINKEDIN_CLIENT_ID')
    if not client_id:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth not configured (LINKEDIN_CLIENT_ID missing)")
    
    # Ensure consistent redirect URI (no trailing slash, exact match)
    redirect_uri = f"{backend_url.rstrip('/')}/api/v1/linkedin-accounts/oauth/callback"
    
    # LinkedIn OAuth scopes
    # openid: Required for OAuth 2.0 OpenID Connect
    # profile: Basic profile information (name, profile picture)
    # email: Email address
    # w_messages: Send messages (requires Partner Program approval)
    # Note: w_messages scope requires LinkedIn Partner Program approval
    # For now, we'll request it - users will need Partner Program access
    scope = "openid profile email w_messages"
    
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": scope,
    }
    
    auth_url = f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"
    
    return {
        "auth_url": auth_url,
        "state": state,
    }


@router.get("/linkedin-accounts/oauth/callback")
async def linkedin_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Handle LinkedIn OAuth callback and redirect to frontend."""
    
    from fastapi.responses import RedirectResponse
    from urllib.parse import urlencode
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    if error:
        error_msg = urlencode({"error": error, "provider": "linkedin"})
        return RedirectResponse(url=f"{frontend_url}/settings/linkedin-accounts/oauth-callback?{error_msg}")
    
    if not code:
        error_msg = urlencode({"error": "No authorization code received", "provider": "linkedin"})
        return RedirectResponse(url=f"{frontend_url}/settings/linkedin-accounts/oauth-callback?{error_msg}")
    
    params = urlencode({
        "code": code.strip() if code else code,
        "state": (state or "").strip(),
        "provider": "linkedin"
    })
    return RedirectResponse(url=f"{frontend_url}/settings/linkedin-accounts/oauth-callback?{params}")


@router.post("/linkedin-accounts/oauth/complete")
async def complete_linkedin_oauth_setup(
    request: OAuthCallbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Complete LinkedIn OAuth setup by exchanging code for tokens and creating LinkedIn account."""
    
    if request.provider != 'linkedin':
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    import httpx
    
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    client_id = os.getenv('LINKEDIN_CLIENT_ID')
    client_secret = os.getenv('LINKEDIN_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth not configured")
    
    # CRITICAL: Redirect URI must EXACTLY match the one used in authorization request
    # No trailing slash, exact same URL
    redirect_uri = f"{backend_url.rstrip('/')}/api/v1/linkedin-accounts/oauth/callback"
    
    # Debug logging
    logger.info(f"[LINKEDIN OAUTH] Token exchange - redirect_uri: {redirect_uri}")
    logger.info(f"[LINKEDIN OAUTH] Token exchange - client_id: {client_id[:10]}...")
    logger.info(f"[LINKEDIN OAUTH] Token exchange - code length: {len(request.code) if request.code else 0}")
    
    try:
        # Exchange code for tokens
        # IMPORTANT: LinkedIn requires the redirect_uri to EXACTLY match the authorization request
        token_data = {
            "grant_type": "authorization_code",
            "code": request.code.strip() if request.code else request.code,
            "redirect_uri": redirect_uri,  # Must match exactly with auth URL
            "client_id": client_id,
            "client_secret": client_secret,
        }
        
        logger.info(f"[LINKEDIN OAUTH] Token exchange request data: grant_type={token_data['grant_type']}, redirect_uri={token_data['redirect_uri']}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30.0
            )
            
            logger.info(f"[LINKEDIN OAUTH] Token exchange response status: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"LinkedIn token exchange failed: {response.status_code} - {error_text}")
                logger.error(f"[LINKEDIN OAUTH] Request redirect_uri was: {redirect_uri}")
                logger.error(f"[LINKEDIN OAUTH] Make sure this EXACTLY matches the redirect URI in LinkedIn app settings")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to exchange authorization code: {error_text}. Make sure the redirect URI in your LinkedIn app settings exactly matches: {redirect_uri}"
                )
            
            tokens = response.json()
        
        access_token = tokens.get('access_token')
        expires_in = tokens.get('expires_in', 5184000)  # Default 60 days
        refresh_token = tokens.get('refresh_token')
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
        
        # Get user profile info
        profile_info = None
        profile_id = None
        display_name = None
        
        if access_token:
            async with httpx.AsyncClient() as client:
                # Try legacy v1 API endpoint first (for r_basicprofile scope)
                try:
                    profile_response = await client.get(
                        "https://api.linkedin.com/v1/people/~:(id,firstName,lastName,emailAddress)",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/json"
                        },
                        timeout=30.0
                    )
                    
                    if profile_response.status_code == 200:
                        profile_info = profile_response.json()
                        profile_id = profile_info.get('id')
                        first_name = profile_info.get('firstName', '')
                        last_name = profile_info.get('lastName', '')
                        display_name = f"{first_name} {last_name}".strip() if first_name or last_name else None
                except Exception as e:
                    logger.warning(f"Error getting profile from v1 endpoint: {e}")
                    # Try v2 API endpoint (for OpenID Connect scopes)
                    try:
                        profile_response = await client.get(
                            "https://api.linkedin.com/v2/userinfo",
                            headers={
                                "Authorization": f"Bearer {access_token}",
                                "Accept": "application/json"
                            },
                            timeout=30.0
                        )
                        
                        if profile_response.status_code == 200:
                            profile_info = profile_response.json()
                            profile_id = profile_info.get('sub') or profile_info.get('id')
                            display_name = profile_info.get('name') or f"{profile_info.get('given_name', '')} {profile_info.get('family_name', '')}".strip()
                    except Exception as v2_error:
                        logger.warning(f"Error getting profile from v2/userinfo endpoint: {v2_error}")
                        # Final fallback to v2/me
                        try:
                            profile_response = await client.get(
                                "https://api.linkedin.com/v2/me",
                                headers={
                                    "Authorization": f"Bearer {access_token}",
                                    "Accept": "application/json"
                                },
                                timeout=30.0
                            )
                            
                            if profile_response.status_code == 200:
                                profile_info = profile_response.json()
                                profile_id = profile_info.get('id')
                                first_name = profile_info.get('localizedFirstName', '')
                                last_name = profile_info.get('localizedLastName', '')
                                display_name = f"{first_name} {last_name}".strip() if first_name or last_name else None
                        except Exception as fallback_error:
                            logger.error(f"Error getting profile from all endpoints: {fallback_error}")
                            # Continue without profile info - we can still save the account
        
        linkedin_profile_url = None
        if profile_id:
            # Construct LinkedIn profile URL
            # Note: LinkedIn profile URLs can be constructed from profile ID or username
            # For now, we'll use a generic format - user can update later
            linkedin_profile_url = f"https://www.linkedin.com/in/{profile_id}"
        
        # Check if account already exists
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.owner_id == current_user.id)
            .where(LinkedInAccount.profile_id == profile_id) if profile_id else select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id).where(LinkedInAccount.profile_id == None)
        )
        existing_account = result.scalar_one_or_none()
        
        if existing_account:
            # Update existing account
            existing_account.access_token = access_token
            existing_account.refresh_token = refresh_token
            existing_account.token_expires_at = token_expires_at
            existing_account.display_name = display_name or existing_account.display_name
            existing_account.linkedin_profile_url = linkedin_profile_url or existing_account.linkedin_profile_url
            existing_account.profile_id = profile_id or existing_account.profile_id
            existing_account.is_active = True
            existing_account.updated_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(existing_account)
            
            return {
                "success": True,
                "message": "LinkedIn account updated successfully",
                "account": {
                    "id": existing_account.id,
                    "profile_id": existing_account.profile_id,
                    "display_name": existing_account.display_name,
                    "linkedin_profile_url": existing_account.linkedin_profile_url,
                }
            }
        
        # Check if this should be default (first account)
        result = await db.execute(
            select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id)
        )
        existing_accounts = result.scalars().all()
        is_first_account = len(existing_accounts) == 0
        
        # If not first account, unset other defaults
        if not is_first_account:
            await db.execute(
                update(LinkedInAccount)
                .where(LinkedInAccount.owner_id == current_user.id)
                .values(is_default=False)
            )
            is_default = True
        else:
            is_default = True
        
        # Create new LinkedIn account
        linkedin_account = LinkedInAccount(
            owner_id=current_user.id,
            profile_id=profile_id,
            linkedin_profile_url=linkedin_profile_url,
            display_name=display_name,
            refresh_token=refresh_token,
            access_token=access_token,
            token_expires_at=token_expires_at,
            is_default=is_default,
            is_active=True,
        )
        
        db.add(linkedin_account)
        await db.commit()
        await db.refresh(linkedin_account)
        
        return {
            "success": True,
            "message": "LinkedIn account connected successfully",
            "account": {
                "id": linkedin_account.id,
                "profile_id": linkedin_account.profile_id,
                "display_name": linkedin_account.display_name,
                "linkedin_profile_url": linkedin_account.linkedin_profile_url,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing LinkedIn OAuth: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete LinkedIn OAuth setup: {str(e)}"
        )


@router.delete("/linkedin-accounts/{account_id}")
async def delete_linkedin_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Delete a LinkedIn account."""
    
    result = await db.execute(
        select(LinkedInAccount)
        .where(LinkedInAccount.id == account_id)
        .where(LinkedInAccount.owner_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(status_code=404, detail="LinkedIn account not found")
    
    await db.execute(
        delete(LinkedInAccount).where(LinkedInAccount.id == account_id)
    )
    await db.commit()
    
    return {"message": "LinkedIn account deleted successfully"}

