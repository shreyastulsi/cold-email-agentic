"""LinkedIn account management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, text
from datetime import datetime, timedelta
import os
import logging
import httpx
from pathlib import Path
from dotenv import load_dotenv
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.linkedin_account import LinkedInAccount
from app.db.base import get_db
from app.core.config import settings

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


class UnipileWebhookRequest(BaseModel):
    status: str  # 'CREATION_SUCCESS' or 'RECONNECTED'
    account_id: str  # Unipile account ID
    name: Optional[str] = None  # Internal user ID we passed


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
                    "unipile_account_id": acc.unipile_account_id,
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


@router.get("/linkedin-accounts/unipile/auth-link")
async def get_unipile_hosted_auth_link(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Generate Unipile Hosted Auth Wizard link for LinkedIn connection."""
    
    unipile_api_key = settings.unipile_api_key
    unipile_base_url = settings.base_url
    
    if not unipile_api_key:
        raise HTTPException(status_code=500, detail="Unipile API key not configured (UNIPILE_API_KEY missing)")
    
    if not unipile_base_url:
        raise HTTPException(status_code=500, detail="Unipile base URL not configured (BASE_URL missing)")
    
    # Extract base API URL (remove /api/v1 if present)
    api_url = unipile_base_url.replace('/api/v1', '').rstrip('/')
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    
    # Set expiration to 1 hour from now
    # Format: YYYY-MM-DDTHH:MM:SS.sssZ (milliseconds, not microseconds)
    expires_datetime = datetime.utcnow() + timedelta(hours=1)
    expires_on = expires_datetime.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    # Success and failure redirect URLs
    success_redirect_url = f"{frontend_url}/settings/linkedin-accounts/unipile-success"
    failure_redirect_url = f"{frontend_url}/settings/linkedin-accounts/unipile-failure"
    
    # Notify URL for webhook callback (optional - only if backend is publicly accessible)
    # For local development, we use API polling instead via /sync endpoint
    notify_url = None
    if backend_url and not backend_url.startswith("http://localhost") and not backend_url.startswith("http://127.0.0.1"):
        notify_url = f"{backend_url.rstrip('/')}/api/v1/linkedin-accounts/unipile/webhook"
    
    # Request payload for Unipile hosted auth link
    payload = {
        "type": "create",
        "providers": ["LINKEDIN"],  # Only LinkedIn
        "api_url": api_url,
        "expiresOn": expires_on,
        "success_redirect_url": success_redirect_url,
        "failure_redirect_url": failure_redirect_url,
        "name": str(current_user.id)  # Pass user ID to match in webhook (if used)
    }
    
    # Only add notify_url if backend is publicly accessible (not localhost)
    if notify_url:
        payload["notify_url"] = notify_url
    
    try:
        # Log request details for debugging
        logger.info(f"Generating Unipile hosted auth link")
        logger.info(f"API URL: {api_url}/api/v1/hosted/accounts/link")
        logger.info(f"API Key present: {bool(unipile_api_key)}")
        logger.info(f"API Key (first 10 chars): {unipile_api_key[:10] if unipile_api_key else 'N/A'}...")
        logger.info(f"Payload: {payload}")
        
        # Generate hosted auth link via Unipile API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{api_url}/api/v1/hosted/accounts/link",
                json=payload,
                headers={
                    "X-API-KEY": unipile_api_key,
                    "accept": "application/json",
                    "content-type": "application/json"
                },
                timeout=30.0
            )
            
            logger.info(f"Unipile API response status: {response.status_code}")
            logger.info(f"Unipile API response headers: {dict(response.headers)}")
            logger.info(f"Unipile API response body: {response.text}")
            
            # Unipile returns 201 for successful creation
            if response.status_code not in [200, 201]:
                error_text = response.text
                logger.error(f"Failed to generate Unipile hosted auth link: {response.status_code} - {error_text}")
                
                # Try to parse error message from response
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", error_json.get("message", error_text))
                except:
                    error_detail = error_text
                
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate Unipile hosted auth link (Status {response.status_code}): {error_detail}"
                )
            
            result = response.json()
            hosted_auth_url = result.get("url")
            
            if not hosted_auth_url:
                logger.error(f"Invalid response from Unipile API: {result}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid response from Unipile API: missing URL. Response: {result}"
                )
            
            logger.info(f"Successfully generated hosted auth link")
            return {
                "auth_url": hosted_auth_url,
                "expires_on": expires_on
            }
            
    except httpx.HTTPError as e:
        logger.error(f"HTTP error generating Unipile hosted auth link: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Unipile API: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error generating Unipile hosted auth link: {str(e)}")
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(error_traceback)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate hosted auth link: {str(e)}. Check backend logs for details."
        )


@router.post("/linkedin-accounts/unipile/sync")
async def sync_unipile_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Sync LinkedIn accounts from Unipile API.
    This checks Unipile for newly connected accounts and creates them in our database.
    This is an alternative to webhooks for local development.
    """
    unipile_api_key = settings.unipile_api_key
    unipile_base_url = settings.base_url
    
    if not unipile_api_key or not unipile_base_url:
        raise HTTPException(status_code=500, detail="Unipile not configured")
    
    try:
        # Get all accounts from Unipile
        api_url = unipile_base_url.replace('/api/v1', '').rstrip('/')
        accounts_endpoint = f"{api_url}/api/v1/accounts"
        
        logger.info(f"Syncing Unipile accounts from: {accounts_endpoint}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                accounts_endpoint,
                headers={
                    "X-API-KEY": unipile_api_key,
                    "accept": "application/json"
                },
                timeout=30.0
            )
            
            logger.info(f"Unipile accounts API response: {response.status_code}")
            logger.info(f"Response body: {response.text[:500]}")  # First 500 chars
            
            if response.status_code not in [200, 201]:
                logger.error(f"Failed to fetch Unipile accounts: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to fetch Unipile accounts: {response.text}"
                )
            
            unipile_accounts = response.json()
            logger.info(f"Unipile accounts response type: {type(unipile_accounts)}")
            logger.info(f"Unipile accounts data: {str(unipile_accounts)[:500]}")
            
            # Handle Unipile API response format: {"object": "AccountList", "items": [...], "cursor": null}
            if isinstance(unipile_accounts, dict):
                # Unipile returns accounts in "items" field
                accounts_list = unipile_accounts.get("items", unipile_accounts.get("accounts", unipile_accounts.get("data", [])))
            else:
                accounts_list = unipile_accounts if isinstance(unipile_accounts, list) else []
            
            logger.info(f"Found {len(accounts_list)} accounts from Unipile")
            
            created_count = 0
            updated_count = 0
            
            # Get existing accounts for this user
            result = await db.execute(
                select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id)
            )
            existing_accounts = {acc.unipile_account_id: acc for acc in result.scalars().all() if acc.unipile_account_id}
            
            # Track processed account IDs to avoid duplicates within this sync
            processed_account_ids = set()
            
            # Process each Unipile account
            for account_data in accounts_list:
                logger.info(f"Processing account: {account_data}")
                # Handle different response formats
                if isinstance(account_data, dict):
                    account_id = account_data.get("id") or account_data.get("account_id")
                    provider = account_data.get("provider") or account_data.get("type", "") or account_data.get("provider_type", "")
                    
                    logger.info(f"Account ID: {account_id}, Provider: {provider}")
                    
                    # Only process LinkedIn accounts
                    if provider.upper() != "LINKEDIN":
                        logger.info(f"Skipping non-LinkedIn account: {provider}")
                        continue
                    
                    if not account_id:
                        logger.warning(f"Account data missing ID: {account_data}")
                        continue
                    
                    # Skip if we've already processed this account_id in this sync
                    if account_id in processed_account_ids:
                        logger.info(f"Skipping duplicate account_id in this sync: {account_id}")
                        continue
                    
                    processed_account_ids.add(account_id)
                    
                    # Extract LinkedIn profile info from Unipile response
                    connection_params = account_data.get("connection_params", {})
                    im_data = connection_params.get("im", {})
                    public_identifier = im_data.get("publicIdentifier")  # e.g., "shreyas-tulsi-4205a31b2"
                    username = im_data.get("username")  # e.g., "Shreyas Tulsi"
                    
                    # Use public_identifier as profile_id if available
                    linkedin_profile_id = public_identifier
                    if linkedin_profile_id:
                        linkedin_profile_url = f"https://www.linkedin.com/in/{linkedin_profile_id}"
                    else:
                        linkedin_profile_url = None
                    
                    display_name = username or account_data.get("name")
                    
                    # Check if account already exists in database (query fresh each time)
                    # Check by unipile_account_id first
                    result = await db.execute(
                        select(LinkedInAccount)
                        .where(LinkedInAccount.owner_id == current_user.id)
                        .where(LinkedInAccount.unipile_account_id == account_id)
                    )
                    existing_account = result.scalar_one_or_none()
                    
                    # If not found by unipile_account_id, check by profile_id (if we have it)
                    if not existing_account and linkedin_profile_id:
                        result = await db.execute(
                            select(LinkedInAccount)
                            .where(LinkedInAccount.owner_id == current_user.id)
                            .where(LinkedInAccount.profile_id == linkedin_profile_id)
                        )
                        existing_account = result.scalar_one_or_none()
                    
                    # If still not found, check if user already has ANY LinkedIn account
                    # (since multiple Unipile account IDs can represent the same LinkedIn profile)
                    if not existing_account:
                        result = await db.execute(
                            select(LinkedInAccount)
                            .where(LinkedInAccount.owner_id == current_user.id)
                            .where(LinkedInAccount.is_active == True)
                        )
                        any_existing = result.scalar_one_or_none()
                        
                        if any_existing:
                            # User already has a LinkedIn account - update it instead of creating new one
                            logger.info(f"User already has LinkedIn account {any_existing.id}, updating it with new Unipile account {account_id}")
                            existing_account = any_existing
                    
                    if existing_account:
                        # Update existing account
                        existing_account.is_active = True
                        existing_account.updated_at = datetime.utcnow()
                        # Update unipile_account_id if it was missing
                        if not existing_account.unipile_account_id:
                            existing_account.unipile_account_id = account_id
                        # Update profile info if missing
                        if linkedin_profile_id and not existing_account.profile_id:
                            existing_account.profile_id = linkedin_profile_id
                        if linkedin_profile_url and not existing_account.linkedin_profile_url:
                            existing_account.linkedin_profile_url = linkedin_profile_url
                        if display_name and not existing_account.display_name:
                            existing_account.display_name = display_name
                        updated_count += 1
                        logger.info(f"Updated existing account: {account_id}")
                    else:
                        # Create new account
                        # Check if this should be default (check database for existing accounts)
                        result = await db.execute(
                            select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id)
                        )
                        existing_accounts_list = result.scalars().all()
                        existing_count = len(existing_accounts_list)
                        is_first_account = existing_count == 0
                        
                        if not is_first_account:
                            await db.execute(
                                update(LinkedInAccount)
                                .where(LinkedInAccount.owner_id == current_user.id)
                                .values(is_default=False)
                            )
                        
                        linkedin_account = LinkedInAccount(
                            owner_id=current_user.id,
                            unipile_account_id=account_id,
                            profile_id=linkedin_profile_id,
                            linkedin_profile_url=linkedin_profile_url,
                            display_name=display_name,
                            is_default=is_first_account,
                            is_active=True,
                        )
                        db.add(linkedin_account)
                        created_count += 1
                        logger.info(f"Created new account: {account_id} (profile: {linkedin_profile_id})")
                        # Refresh existing_accounts dict for next iteration
                        existing_accounts[account_id] = linkedin_account
            
            await db.commit()
            
            logger.info(f"Synced Unipile accounts: {created_count} created, {updated_count} updated")
            logger.info(f"Total accounts processed: {len(accounts_list)}, LinkedIn accounts found: {created_count + updated_count}")
            
            return {
                "success": True,
                "created": created_count,
                "updated": updated_count,
                "total_found": len(accounts_list),
                "message": f"Synced {created_count + updated_count} LinkedIn account(s) from {len(accounts_list)} total account(s)"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing Unipile accounts: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync accounts: {str(e)}"
        )


@router.get("/linkedin-accounts/debug")
async def debug_linkedin_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Debug endpoint to see all LinkedIn accounts and their identifiers."""
    try:
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.owner_id == current_user.id)
            .order_by(LinkedInAccount.created_at.asc())
        )
        accounts = result.scalars().all()
        
        return {
            "total": len(accounts),
            "accounts": [
                {
                    "id": acc.id,
                    "unipile_account_id": acc.unipile_account_id,
                    "profile_id": acc.profile_id,
                    "display_name": acc.display_name,
                    "linkedin_profile_url": acc.linkedin_profile_url,
                    "created_at": acc.created_at.isoformat(),
                    "is_active": acc.is_active,
                    "is_default": acc.is_default,
                }
                for acc in accounts
            ]
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/linkedin-accounts/cleanup-duplicates")
async def cleanup_duplicate_linkedin_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Remove duplicate LinkedIn accounts for the current user.
    Keeps only ONE account total - the oldest one with unipile_account_id, or oldest overall.
    This is aggressive cleanup since multiple Unipile account IDs can represent the same LinkedIn profile.
    """
    try:
        # Get all accounts for this user
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.owner_id == current_user.id)
            .order_by(
                # Prefer accounts with unipile_account_id, then by creation date
                LinkedInAccount.unipile_account_id.isnot(None).desc(),
                LinkedInAccount.created_at.asc()
            )
        )
        all_accounts = result.scalars().all()
        
        logger.info(f"Found {len(all_accounts)} LinkedIn accounts for user {current_user.id}")
        
        if len(all_accounts) <= 1:
            return {
                "success": True,
                "removed": 0,
                "kept": len(all_accounts),
                "message": "No duplicates found"
            }
        
        # Keep only the first account (oldest, or oldest with unipile_account_id)
        account_to_keep = all_accounts[0]
        duplicates_to_delete = [acc.id for acc in all_accounts[1:]]
        
        logger.info(f"Keeping account {account_to_keep.id} (unipile_account_id: {account_to_keep.unipile_account_id}, created: {account_to_keep.created_at})")
        logger.info(f"Deleting {len(duplicates_to_delete)} duplicate accounts: {duplicates_to_delete}")
        
        # Delete all duplicates
        await db.execute(
            delete(LinkedInAccount)
            .where(LinkedInAccount.id.in_(duplicates_to_delete))
            .where(LinkedInAccount.owner_id == current_user.id)
        )
        await db.commit()
        
        logger.info(f"Removed {len(duplicates_to_delete)} duplicate LinkedIn accounts for user {current_user.id}")
        
        return {
            "success": True,
            "removed": len(duplicates_to_delete),
            "kept": 1,
            "message": f"Removed {len(duplicates_to_delete)} duplicate account(s), kept 1 account"
        }
            
    except Exception as e:
        logger.error(f"Error cleaning up duplicates: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup duplicates: {str(e)}"
        )


@router.post("/linkedin-accounts/unipile/webhook")
async def unipile_account_webhook(
    request: UnipileWebhookRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Webhook endpoint to receive account connection notifications from Unipile.
    
    NOTE: This endpoint is public (no authentication required) because Unipile calls it directly.
    In production, consider adding:
    - IP whitelisting for Unipile servers
    - Webhook signature verification (if Unipile supports it)
    - Rate limiting
    """
    
    logger.info(f"Received Unipile webhook: status={request.status}, account_id={request.account_id}, name={request.name}")
    
    if request.status not in ["CREATION_SUCCESS", "RECONNECTED"]:
        logger.warning(f"Unknown webhook status: {request.status}")
        return {"status": "ignored", "message": f"Unknown status: {request.status}"}
    
    if not request.account_id:
        logger.error("Webhook missing account_id")
        raise HTTPException(status_code=400, detail="Missing account_id in webhook payload")
    
    # Extract user ID from name parameter (we passed current_user.id when generating link)
    user_id = request.name
    if not user_id:
        logger.error("Webhook missing name (user_id)")
        raise HTTPException(status_code=400, detail="Missing name (user_id) in webhook payload")
    
    try:
        # Get user from database
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            logger.error(f"User not found: {user_id}")
            raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
        
        # Check if account already exists
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.owner_id == user_id)
            .where(LinkedInAccount.unipile_account_id == request.account_id)
        )
        existing_account = result.scalar_one_or_none()
        
        if existing_account:
            # Update existing account
            existing_account.is_active = True
            existing_account.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(existing_account)
            
            logger.info(f"Updated existing LinkedIn account: {existing_account.id} with Unipile account: {request.account_id}")
            return {
                "status": "success",
                "message": "Account updated",
                "account_id": existing_account.id
            }
        
        # Check if this should be default (first account)
        result = await db.execute(
            select(LinkedInAccount).where(LinkedInAccount.owner_id == user_id)
        )
        existing_accounts = result.scalars().all()
        is_first_account = len(existing_accounts) == 0
        
        # If not first account, unset other defaults
        if not is_first_account:
            await db.execute(
                update(LinkedInAccount)
                .where(LinkedInAccount.owner_id == user_id)
                .values(is_default=False)
            )
            is_default = True
        else:
            is_default = True
        
        # Create new LinkedIn account with Unipile account ID
        linkedin_account = LinkedInAccount(
            owner_id=user_id,
            unipile_account_id=request.account_id,
            is_default=is_default,
            is_active=True,
        )
        
        db.add(linkedin_account)
        await db.commit()
        await db.refresh(linkedin_account)
        
        logger.info(f"Created new LinkedIn account: {linkedin_account.id} with Unipile account: {request.account_id}")
        
        return {
            "status": "success",
            "message": "Account created",
            "account_id": linkedin_account.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Unipile webhook: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process webhook: {str(e)}"
        )


@router.get("/linkedin-accounts/oauth/auth-url")
async def get_linkedin_oauth_auth_url(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get LinkedIn OAuth authorization URL (legacy - kept for backward compatibility)."""
    
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

