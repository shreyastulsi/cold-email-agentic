"""LinkedIn account management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from datetime import datetime, timedelta
import os
import logging
import httpx
from pathlib import Path
from dotenv import load_dotenv
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.linkedin_account import LinkedInAccount
from app.db.models.user_settings import UserSettings
from app.db.base import get_db
from app.core.config import settings
from app.services.user_settings_service import (
    get_or_create_user_settings,
    set_active_linkedin_account
)

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
    """List the active LinkedIn account for the current user (only one account shown based on user_settings)."""
    try:
        # Get user settings to find active LinkedIn account
        user_settings = await get_or_create_user_settings(current_user.id, db)
        
        accounts = []
        
        # If user has an active LinkedIn account set, return only that one
        if user_settings.active_linkedin_account_id:
            result = await db.execute(
                select(LinkedInAccount)
                .where(LinkedInAccount.id == user_settings.active_linkedin_account_id)
                .where(LinkedInAccount.owner_id == current_user.id)
            )
            active_account = result.scalar_one_or_none()
            
            if active_account:
                accounts = [active_account]
            else:
                # Active account ID doesn't exist or doesn't belong to user - clear it
                logger.warning(f"Active LinkedIn account {user_settings.active_linkedin_account_id} not found for user {current_user.id}, clearing it")
                user_settings.active_linkedin_account_id = None
                await db.commit()
        
        # If no active account set, check if user has any LinkedIn accounts and set the first one as active
        # BUT: if user just deleted their account, they might not want another one automatically selected
        # So we'll only auto-select if there are accounts AND no active one is set
        if not accounts:
            result = await db.execute(
                select(LinkedInAccount)
                .where(LinkedInAccount.owner_id == current_user.id)
                .order_by(LinkedInAccount.created_at.desc())
            )
            all_accounts = result.scalars().all()
            
            # Only auto-select if there's exactly one account (clean state)
            # If there are multiple, something went wrong - don't auto-select
            if len(all_accounts) == 1:
                # Only one account - set it as active
                first_account = all_accounts[0]
                user_settings.active_linkedin_account_id = first_account.id
                await db.commit()
                accounts = [first_account]
            elif len(all_accounts) > 1:
                # Multiple accounts - this shouldn't happen, but clean it up
                logger.warning(f"User {current_user.id} has {len(all_accounts)} LinkedIn accounts, should only have one. Keeping most recent.")
                # Keep the most recent one, delete the rest
                first_account = all_accounts[0]
                accounts_to_delete = [acc.id for acc in all_accounts[1:]]
                if accounts_to_delete:
                    await db.execute(
                        delete(LinkedInAccount)
                        .where(LinkedInAccount.id.in_(accounts_to_delete))
                        .where(LinkedInAccount.owner_id == current_user.id)
                    )
                user_settings.active_linkedin_account_id = first_account.id
                await db.commit()
                accounts = [first_account]
            # If no accounts, return empty list (user deleted all accounts)
        
        return {
            "accounts": [
                {
                    "id": acc.id,
                    "linkedin_profile_url": acc.linkedin_profile_url,
                    "profile_id": acc.profile_id,
                    "display_name": acc.display_name,
                    "unipile_account_id": acc.unipile_account_id,
                    "is_active": True,  # Always true - only one account allowed
                    "is_default": True,  # Always true - only one account allowed
                    "is_premium": acc.is_premium,  # LinkedIn Premium status (None = unknown, True = premium, False = free)
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Generate Unipile Hosted Auth Wizard link for LinkedIn connection."""
    
    # Check if user already has a LinkedIn account - only one allowed
    result = await db.execute(
        select(LinkedInAccount)
        .where(LinkedInAccount.owner_id == current_user.id)
    )
    existing_account = result.scalar_one_or_none()
    
    if existing_account:
        raise HTTPException(
            status_code=400,
            detail="You already have a LinkedIn account connected. Please delete your current account first if you want to connect a different one."
        )
    
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
    Sync LinkedIn accounts from Unipile API for the current user only.
    This checks Unipile for newly connected accounts and only creates/updates accounts
    that belong to the current user. Prevents duplicate accounts across users.
    """
    unipile_api_key = settings.unipile_api_key
    unipile_base_url = settings.base_url
    
    if not unipile_api_key or not unipile_base_url:
        raise HTTPException(status_code=500, detail="Unipile not configured")
    
    try:
        # Get all accounts from Unipile
        api_url = unipile_base_url.replace('/api/v1', '').rstrip('/')
        accounts_endpoint = f"{api_url}/api/v1/accounts"
        
        logger.info(f"Syncing Unipile accounts for user {current_user.id} from: {accounts_endpoint}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                accounts_endpoint,
                headers={
                    "X-API-KEY": unipile_api_key,
                    "accept": "application/json"
                },
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                logger.error(f"Failed to fetch Unipile accounts: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to fetch Unipile accounts: {response.text}"
                )
            
            unipile_accounts = response.json()
            
            # Handle Unipile API response format: {"object": "AccountList", "items": [...], "cursor": null}
            if isinstance(unipile_accounts, dict):
                accounts_list = unipile_accounts.get("items", unipile_accounts.get("accounts", unipile_accounts.get("data", [])))
            else:
                accounts_list = unipile_accounts if isinstance(unipile_accounts, list) else []
            
            logger.info(f"Found {len(accounts_list)} total accounts from Unipile")
            
            # Get all existing LinkedIn accounts in our database (across all users)
            # This helps us detect if an account already belongs to another user
            all_existing_accounts_result = await db.execute(
                select(LinkedInAccount)
            )
            all_existing_accounts = {
                acc.unipile_account_id: acc 
                for acc in all_existing_accounts_result.scalars().all() 
                if acc.unipile_account_id
            }
            
            # Also index by profile_id to catch duplicates
            all_existing_by_profile = {
                acc.profile_id: acc
                for acc in all_existing_accounts_result.scalars().all()
                if acc.profile_id
            }
            
            # Get existing accounts for current user only
            user_accounts_result = await db.execute(
                select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id)
            )
            user_existing_accounts = {
                acc.unipile_account_id: acc 
                for acc in user_accounts_result.scalars().all() 
                if acc.unipile_account_id
            }
            user_existing_by_profile = {
                acc.profile_id: acc
                for acc in user_accounts_result.scalars().all()
                if acc.profile_id
            }
            
            created_count = 0
            updated_count = 0
            skipped_count = 0
            
            # Get user settings
            user_settings = await get_or_create_user_settings(current_user.id, db)
            
            # Filter LinkedIn accounts that don't belong to other users
            # and find the most recent one to use as the active account
            candidate_accounts = []
            
            # Track processed account IDs to avoid duplicates within this sync
            processed_account_ids = set()
            
            # Process each Unipile account to find valid candidates
            for account_data in accounts_list:
                if not isinstance(account_data, dict):
                    continue
                    
                account_id = account_data.get("id") or account_data.get("account_id")
                provider = account_data.get("provider") or account_data.get("type", "") or account_data.get("provider_type", "")
                
                # Only process LinkedIn accounts
                if provider.upper() != "LINKEDIN":
                    continue
                
                if not account_id:
                    logger.warning(f"Account data missing ID: {account_data}")
                    continue
                
                # Skip if we've already processed this account_id in this sync
                if account_id in processed_account_ids:
                    continue
                
                processed_account_ids.add(account_id)
                
                # Extract LinkedIn profile info from Unipile response
                connection_params = account_data.get("connection_params", {})
                im_data = connection_params.get("im", {})
                public_identifier = im_data.get("publicIdentifier")
                username = im_data.get("username")
                
                linkedin_profile_id = public_identifier
                linkedin_profile_url = f"https://www.linkedin.com/in/{linkedin_profile_id}" if linkedin_profile_id else None
                
                # Try multiple sources for display name (in order of preference)
                display_name = (
                    im_data.get("name") or  # Full name from IM data
                    username or  # Username from IM data
                    account_data.get("name") or  # Name from account data
                    account_data.get("display_name") or  # Display name from account data
                    (f"{im_data.get('firstName', '')} {im_data.get('lastName', '')}".strip() if im_data.get('firstName') or im_data.get('lastName') else None) or  # First + Last name
                    public_identifier  # Fallback to profile ID
                )
                
                # Log what we extracted for debugging
                logger.info(f"Extracted LinkedIn account data: profile_id={linkedin_profile_id}, display_name={display_name}, username={username}, account_data_keys={list(account_data.keys())}")
                
                # CRITICAL: Check if this account already exists for a DIFFERENT user
                # If it does, skip it to prevent duplicate accounts across users
                belongs_to_other_user = False
                if account_id in all_existing_accounts:
                    existing_account = all_existing_accounts[account_id]
                    if existing_account.owner_id != current_user.id:
                        logger.info(f"Skipping account {account_id} - already belongs to user {existing_account.owner_id}")
                        skipped_count += 1
                        belongs_to_other_user = True
                
                # Also check by profile_id if we have it
                if not belongs_to_other_user and linkedin_profile_id and linkedin_profile_id in all_existing_by_profile:
                    existing_account = all_existing_by_profile[linkedin_profile_id]
                    if existing_account.owner_id != current_user.id:
                        logger.info(f"Skipping account with profile_id {linkedin_profile_id} - already belongs to user {existing_account.owner_id}")
                        skipped_count += 1
                        belongs_to_other_user = True
                
                if not belongs_to_other_user:
                    # This account can be a candidate for the current user
                    # Check if it already exists for this user
                    existing_account = user_existing_accounts.get(account_id)
                    
                    # If not found by unipile_account_id, check by profile_id
                    if not existing_account and linkedin_profile_id and linkedin_profile_id in user_existing_by_profile:
                        existing_account = user_existing_by_profile[linkedin_profile_id]
                    
                    # Add to candidate list with account data and whether it exists
                    candidate_accounts.append({
                        'account_id': account_id,
                        'linkedin_profile_id': linkedin_profile_id,
                        'linkedin_profile_url': linkedin_profile_url,
                        'display_name': display_name,
                        'existing_account': existing_account,
                        'account_data': account_data
                    })
            
            # Now process candidates: we want to keep ONLY ONE account per user
            # Always use the most recent candidate from Unipile and delete all others
            active_linkedin_account = None
            
            if candidate_accounts:
                # Sort candidates by creation date (most recent first) if available
                # Unipile typically returns accounts in creation order, but we'll sort to be safe
                def get_account_created_at(candidate):
                    account_data = candidate.get('account_data', {})
                    # Try to get created_at from account_data
                    created_at = account_data.get('created_at') or account_data.get('createdAt') or account_data.get('created')
                    if created_at:
                        try:
                            # Try ISO format first (most common)
                            if isinstance(created_at, str):
                                # Handle ISO format with or without microseconds
                                if 'T' in created_at:
                                    try:
                                        return datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                                    except:
                                        # Try without timezone
                                        return datetime.fromisoformat(created_at.split('+')[0].split('Z')[0])
                                # Try other common formats
                                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
                                    try:
                                        return datetime.strptime(created_at, fmt)
                                    except:
                                        continue
                        except:
                            pass
                    # Default to now if we can't parse (newest accounts will be at the end)
                    return datetime.utcnow()
                
                # Sort by creation date (most recent first)
                candidate_accounts.sort(key=get_account_created_at, reverse=True)
                
                # Get the first candidate (most recent) - this is the account we want to keep
                candidate = candidate_accounts[0]
                logger.info(f"Selected most recent LinkedIn account from {len(candidate_accounts)} candidate(s): unipile_id={candidate['account_id']}, display_name={candidate['display_name']}")
                
                # CRITICAL: Delete ALL existing LinkedIn accounts for this user FIRST
                # This ensures we always use the newest account from Unipile, even if it's a different person
                user_accounts_result = await db.execute(
                    select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id)
                )
                all_user_accounts = list(user_accounts_result.scalars().all())
                
                if all_user_accounts:
                    account_ids_to_delete = [acc.id for acc in all_user_accounts]
                    
                    # Clear user_settings references first
                    for acc_id in account_ids_to_delete:
                        await db.execute(
                            update(UserSettings)
                            .where(UserSettings.active_linkedin_account_id == acc_id)
                            .values(active_linkedin_account_id=None, updated_at=datetime.utcnow())
                        )
                    
                    # Delete all existing accounts
                    await db.execute(
                        delete(LinkedInAccount)
                        .where(LinkedInAccount.id.in_(account_ids_to_delete))
                        .where(LinkedInAccount.owner_id == current_user.id)
                    )
                    logger.info(f"Deleted {len(account_ids_to_delete)} existing LinkedIn account(s) for user {current_user.id} before creating new one")
                    await db.flush()
                
                # Try to extract premium status from Unipile account data
                # Check various possible fields where premium status might be stored
                account_data = candidate.get('account_data', {})
                is_premium = None  # Default to unknown
                
                # Try to find premium/subscription info in account_data
                if account_data:
                    # Check for explicit premium/subscription fields
                    premium_status = (
                        account_data.get('is_premium') or
                        account_data.get('premium') or
                        account_data.get('subscription_type') or
                        account_data.get('account_type')
                    )
                    
                    if premium_status is not None:
                        # Convert to boolean if it's a string
                        if isinstance(premium_status, str):
                            is_premium = premium_status.lower() in ['premium', 'true', '1', 'yes', 'paid']
                        elif isinstance(premium_status, bool):
                            is_premium = premium_status
                        elif isinstance(premium_status, (int, float)):
                            is_premium = bool(premium_status)
                
                # Now create the new account with data from Unipile (always use the newest one)
                active_linkedin_account = LinkedInAccount(
                    owner_id=current_user.id,
                    unipile_account_id=candidate['account_id'],
                    profile_id=candidate['linkedin_profile_id'],
                    linkedin_profile_url=candidate['linkedin_profile_url'],
                    display_name=candidate['display_name'],  # Always use the name from Unipile
                    is_active=True,
                    is_default=True,
                    is_premium=is_premium,  # LinkedIn Premium status (None = unknown)
                )
                db.add(active_linkedin_account)
                created_count += 1
                logger.info(f"Created new LinkedIn account for user {current_user.id}: unipile_id={candidate['account_id']}, profile_id={candidate['linkedin_profile_id']}, display_name={candidate['display_name']}")
                
                # Flush to get the ID
                await db.flush()
                
                # Set this account as active in user_settings
                user_settings.active_linkedin_account_id = active_linkedin_account.id
                user_settings.updated_at = datetime.utcnow()
            
            await db.commit()
            
            logger.info(f"Synced Unipile accounts for user {current_user.id}: {created_count} created, {updated_count} updated, {skipped_count} skipped (belong to other users)")
            
            return {
                "success": True,
                "created": created_count,
                "updated": updated_count,
                "skipped": skipped_count,
                "total_found": len(accounts_list),
                "message": f"Synced {created_count + updated_count} LinkedIn account(s) for your account. {skipped_count} account(s) skipped (belong to other users)."
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
    Only removes accounts that have the same profile_id or unipile_account_id.
    Users can have multiple LinkedIn accounts with different profiles.
    
    Also checks for accounts that belong to other users (shouldn't happen, but fixes data integrity issues).
    """
    try:
        # Get all accounts for this user
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.owner_id == current_user.id)
            .order_by(LinkedInAccount.created_at.asc())
        )
        user_accounts = list(result.scalars().all())
        
        logger.info(f"Found {len(user_accounts)} LinkedIn accounts for user {current_user.id}")
        
        if len(user_accounts) <= 1:
            return {
                "success": True,
                "removed": 0,
                "kept": len(user_accounts),
                "message": "No duplicates found"
            }
        
        # Also check for accounts that might belong to other users but have same identifiers
        # Get all accounts across all users to check for cross-user duplicates
        all_accounts_result = await db.execute(
            select(LinkedInAccount)
            .where(
                (LinkedInAccount.unipile_account_id.isnot(None)) |
                (LinkedInAccount.profile_id.isnot(None))
            )
        )
        all_accounts = list(all_accounts_result.scalars().all())
        
        # Find actual duplicates by profile_id or unipile_account_id
        seen_profile_ids = {}
        seen_unipile_ids = {}
        duplicates_to_delete = []
        
        # First pass: mark duplicates within user's accounts
        for account in user_accounts:
            # Check for duplicates by profile_id (if present)
            if account.profile_id:
                if account.profile_id in seen_profile_ids:
                    # This is a duplicate by profile_id - keep the first one, mark this for deletion
                    duplicates_to_delete.append(account.id)
                    logger.info(f"Found duplicate by profile_id {account.profile_id}: account {account.id} (keeping {seen_profile_ids[account.profile_id]})")
                else:
                    seen_profile_ids[account.profile_id] = account.id
            
            # Check for duplicates by unipile_account_id (if present)
            if account.unipile_account_id:
                if account.unipile_account_id in seen_unipile_ids:
                    # This is a duplicate by unipile_account_id - keep the first one, mark this for deletion
                    if account.id not in duplicates_to_delete:  # Avoid double-counting
                        duplicates_to_delete.append(account.id)
                    logger.info(f"Found duplicate by unipile_account_id {account.unipile_account_id}: account {account.id} (keeping {seen_unipile_ids[account.unipile_account_id]})")
                else:
                    seen_unipile_ids[account.unipile_account_id] = account.id
        
        # Second pass: check if any of user's accounts are duplicates of accounts belonging to other users
        # This shouldn't happen, but we'll clean it up if it does
        cross_user_duplicates = []
        for account in user_accounts:
            if account.id in duplicates_to_delete:
                continue  # Already marked for deletion
            
            # Check if this account's identifiers match accounts from other users
            for other_account in all_accounts:
                if other_account.owner_id == current_user.id:
                    continue  # Skip own accounts
                
                # Check by unipile_account_id
                if (account.unipile_account_id and 
                    other_account.unipile_account_id and 
                    account.unipile_account_id == other_account.unipile_account_id):
                    cross_user_duplicates.append(account.id)
                    logger.warning(f"Found cross-user duplicate by unipile_account_id {account.unipile_account_id}: user's account {account.id} matches other user's account {other_account.id}")
                    break
                
                # Check by profile_id
                if (account.profile_id and 
                    other_account.profile_id and 
                    account.profile_id == other_account.profile_id):
                    cross_user_duplicates.append(account.id)
                    logger.warning(f"Found cross-user duplicate by profile_id {account.profile_id}: user's account {account.id} matches other user's account {other_account.id}")
                    break
        
        # Combine both types of duplicates
        all_duplicates = list(set(duplicates_to_delete + cross_user_duplicates))
        
        if not all_duplicates:
            return {
                "success": True,
                "removed": 0,
                "kept": len(user_accounts),
                "message": "No duplicates found - all accounts have unique identifiers"
            }
        
        logger.info(f"Deleting {len(all_duplicates)} duplicate accounts: {all_duplicates}")
        
        # Delete only the actual duplicates (ensure they belong to current user for safety)
        await db.execute(
            delete(LinkedInAccount)
            .where(LinkedInAccount.id.in_(all_duplicates))
            .where(LinkedInAccount.owner_id == current_user.id)
        )
        await db.commit()
        
        logger.info(f"Removed {len(all_duplicates)} duplicate LinkedIn accounts for user {current_user.id}")
        
        return {
            "success": True,
            "removed": len(all_duplicates),
            "kept": len(user_accounts) - len(all_duplicates),
            "message": f"Removed {len(all_duplicates)} duplicate account(s), kept {len(user_accounts) - len(all_duplicates)} account(s)"
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
        
        # Get user settings
        user_settings = await get_or_create_user_settings(user_id, db)
        
        # Delete all existing LinkedIn accounts for this user (we only want one)
        # Also clear any user_settings that reference these accounts
        result = await db.execute(
            select(LinkedInAccount).where(LinkedInAccount.owner_id == user_id)
        )
        existing_accounts = result.scalars().all()
        
        if existing_accounts:
            account_ids_to_delete = [acc.id for acc in existing_accounts]
            
            # Clear user_settings references first
            # Use ORM update instead of raw SQL to avoid async issues
            for acc_id in account_ids_to_delete:
                await db.execute(
                    update(UserSettings)
                    .where(UserSettings.active_linkedin_account_id == acc_id)
                    .values(active_linkedin_account_id=None, updated_at=datetime.utcnow())
                )
            
            await db.execute(
                delete(LinkedInAccount)
                .where(LinkedInAccount.id.in_(account_ids_to_delete))
                .where(LinkedInAccount.owner_id == user_id)
            )
            logger.info(f"Deleted {len(account_ids_to_delete)} existing LinkedIn accounts for user {user_id} before creating new one")
            await db.flush()
        
        # Create new LinkedIn account with Unipile account ID (only one allowed per user)
        linkedin_account = LinkedInAccount(
            owner_id=user_id,
            unipile_account_id=request.account_id,
            is_default=True,
            is_active=True,
        )
        
        db.add(linkedin_account)
        await db.flush()  # Get the ID
        
        # Set this account as active in user_settings
        user_settings.active_linkedin_account_id = linkedin_account.id
        user_settings.updated_at = datetime.utcnow()
        
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get LinkedIn OAuth authorization URL (legacy - kept for backward compatibility)."""
    
    # Check if user already has a LinkedIn account - only one allowed
    result = await db.execute(
        select(LinkedInAccount)
        .where(LinkedInAccount.owner_id == current_user.id)
    )
    existing_account = result.scalar_one_or_none()
    
    if existing_account:
        raise HTTPException(
            status_code=400,
            detail="You already have a LinkedIn account connected. Please delete your current account first if you want to connect a different one."
        )
    
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
    """Complete LinkedIn OAuth setup by exchanging code for tokens and creating LinkedIn account.
    Automatically deletes any existing LinkedIn account for the user (only one allowed)."""
    
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
        
        # Get user settings
        user_settings = await get_or_create_user_settings(current_user.id, db)
        
        # Delete all existing LinkedIn accounts for this user (we only want one)
        # Also clear any user_settings that reference these accounts
        result = await db.execute(
            select(LinkedInAccount).where(LinkedInAccount.owner_id == current_user.id)
        )
        existing_accounts = result.scalars().all()
        
        if existing_accounts:
            account_ids_to_delete = [acc.id for acc in existing_accounts]
            
            # Clear user_settings references first
            # Use ORM update instead of raw SQL to avoid async issues
            for acc_id in account_ids_to_delete:
                await db.execute(
                    update(UserSettings)
                    .where(UserSettings.active_linkedin_account_id == acc_id)
                    .values(active_linkedin_account_id=None, updated_at=datetime.utcnow())
                )
            
            await db.execute(
                delete(LinkedInAccount)
                .where(LinkedInAccount.id.in_(account_ids_to_delete))
                .where(LinkedInAccount.owner_id == current_user.id)
            )
            logger.info(f"Deleted {len(account_ids_to_delete)} existing LinkedIn accounts for user {current_user.id} before creating new one")
            await db.flush()
        
        # Create new LinkedIn account (only one allowed per user)
        linkedin_account = LinkedInAccount(
            owner_id=current_user.id,
            profile_id=profile_id,
            linkedin_profile_url=linkedin_profile_url,
            display_name=display_name,
            refresh_token=refresh_token,
            access_token=access_token,
            token_expires_at=token_expires_at,
            is_default=True,
            is_active=True,
        )
        
        db.add(linkedin_account)
        await db.flush()  # Get the ID
        
        # Set this account as active in user_settings
        user_settings.active_linkedin_account_id = linkedin_account.id
        user_settings.updated_at = datetime.utcnow()
        
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


class LinkedInAccountUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    is_premium: Optional[bool] = None  # Allow manually setting premium status
    # Removed is_active and is_default - users can only have one account, no need for enable/disable


@router.put("/linkedin-accounts/{account_id}")
async def update_linkedin_account(
    account_id: int,
    request: LinkedInAccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Update a LinkedIn account (only display_name can be updated - no enable/disable)."""
    
    # Get account
    result = await db.execute(
        select(LinkedInAccount)
        .where(LinkedInAccount.id == account_id)
        .where(LinkedInAccount.owner_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(status_code=404, detail="LinkedIn account not found")
    
    # Allow updating display_name and is_premium
    if request.display_name is not None:
        account.display_name = request.display_name
    if request.is_premium is not None:
        account.is_premium = request.is_premium
    
    account.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(account)
    
    return {
        "id": account.id,
        "linkedin_profile_url": account.linkedin_profile_url,
        "profile_id": account.profile_id,
        "display_name": account.display_name,
        "is_premium": account.is_premium,
        "is_active": True,  # Always true since there's only one account
        "is_default": True,  # Always true since there's only one account
    }


@router.delete("/linkedin-accounts/{account_id}")
async def delete_linkedin_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Delete a LinkedIn account."""
    try:
        # Get the account first to verify it exists and belongs to user
        result = await db.execute(
            select(LinkedInAccount)
            .where(LinkedInAccount.id == account_id)
            .where(LinkedInAccount.owner_id == current_user.id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            raise HTTPException(status_code=404, detail="LinkedIn account not found")
        
        logger.info(f"Deleting LinkedIn account {account_id} for user {current_user.id}")
        
        # CRITICAL: Clear active account from ALL user_settings that reference this account
        # This prevents foreign key constraint errors
        # First, find all user_settings that reference this account
        result = await db.execute(
            select(UserSettings).where(UserSettings.active_linkedin_account_id == account_id)
        )
        affected_settings = result.scalars().all()
        
        # Clear the reference from all affected user_settings
        for setting in affected_settings:
            setting.active_linkedin_account_id = None
            setting.updated_at = datetime.utcnow()
            logger.info(f"Clearing active LinkedIn account {account_id} from user_settings for user {setting.user_id}")
        
        await db.flush()  # Flush the updates
        
        # Delete the account
        await db.execute(
            delete(LinkedInAccount)
            .where(LinkedInAccount.id == account_id)
            .where(LinkedInAccount.owner_id == current_user.id)
        )
        
        # Commit all changes together
        await db.commit()
        
        logger.info(f"Successfully deleted LinkedIn account {account_id} for user {current_user.id}")
        
        return {"message": "LinkedIn account deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        error_msg = str(e)
        logger.error(f"Error deleting LinkedIn account {account_id}: {error_msg}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Check if it's a foreign key constraint error
        if "foreign key" in error_msg.lower() or "violates foreign key" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete LinkedIn account due to database constraint. Please run database migrations: alembic upgrade head. Error: {error_msg}"
            )
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete LinkedIn account: {error_msg}"
        )

