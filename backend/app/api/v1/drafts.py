"""Draft management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from datetime import datetime
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.draft import Draft
from app.db.models.email_account import EmailAccount
from app.db.base import get_db
from app.services.unified_messenger.adapter import send_invitation, send_email

router = APIRouter()


class DraftCreateRequest(BaseModel):
    draft_type: str  # 'email', 'linkedin', or 'both'
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_linkedin_url: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    linkedin_message: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    recruiter_info: Optional[Dict[str, Any]] = None


class DraftUpdateRequest(BaseModel):
    draft_type: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_linkedin_url: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    linkedin_message: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    recruiter_info: Optional[Dict[str, Any]] = None


class DraftSendRequest(BaseModel):
    send_email: Optional[bool] = False
    send_linkedin: Optional[bool] = False


@router.post("/drafts")
async def create_draft(
    request: DraftCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Create a new draft."""
    draft = Draft(
        owner_id=current_user.id,
        draft_type=request.draft_type,
        recipient_name=request.recipient_name,
        recipient_email=request.recipient_email,
        recipient_linkedin_url=request.recipient_linkedin_url,
        email_subject=request.email_subject,
        email_body=request.email_body,
        linkedin_message=request.linkedin_message,
        job_title=request.job_title,
        company_name=request.company_name,
        recruiter_info=request.recruiter_info,
    )
    
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    
    return {
        "success": True,
        "draft": {
            "id": draft.id,
            "draft_type": draft.draft_type,
            "recipient_name": draft.recipient_name,
            "recipient_email": draft.recipient_email,
            "recipient_linkedin_url": draft.recipient_linkedin_url,
            "email_subject": draft.email_subject,
            "email_body": draft.email_body,
            "linkedin_message": draft.linkedin_message,
            "job_title": draft.job_title,
            "company_name": draft.company_name,
            "is_sent": draft.is_sent,
            "created_at": draft.created_at.isoformat(),
            "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        }
    }


@router.get("/drafts")
async def list_drafts(
    include_sent: Optional[bool] = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """List all drafts for the current user."""
    query = select(Draft).where(Draft.owner_id == current_user.id)
    
    if not include_sent:
        query = query.where(Draft.is_sent == False)
    
    query = query.order_by(Draft.created_at.desc())
    
    result = await db.execute(query)
    drafts = result.scalars().all()
    
    return {
        "drafts": [
            {
                "id": draft.id,
                "draft_type": draft.draft_type,
                "recipient_name": draft.recipient_name,
                "recipient_email": draft.recipient_email,
                "recipient_linkedin_url": draft.recipient_linkedin_url,
                "email_subject": draft.email_subject,
                "email_body": draft.email_body,
                "linkedin_message": draft.linkedin_message,
                "job_title": draft.job_title,
                "company_name": draft.company_name,
                "recruiter_info": draft.recruiter_info,
                "is_sent": draft.is_sent,
                "email_sent": draft.email_sent,
                "linkedin_sent": draft.linkedin_sent,
                "sent_at": draft.sent_at.isoformat() if draft.sent_at else None,
                "email_sent_at": draft.email_sent_at.isoformat() if draft.email_sent_at else None,
                "linkedin_sent_at": draft.linkedin_sent_at.isoformat() if draft.linkedin_sent_at else None,
                "created_at": draft.created_at.isoformat(),
                "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
            }
            for draft in drafts
        ]
    }


@router.get("/drafts/{draft_id}")
async def get_draft(
    draft_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get a specific draft."""
    result = await db.execute(
        select(Draft)
        .where(Draft.id == draft_id)
        .where(Draft.owner_id == current_user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return {
        "draft": {
            "id": draft.id,
            "draft_type": draft.draft_type,
            "recipient_name": draft.recipient_name,
            "recipient_email": draft.recipient_email,
            "recipient_linkedin_url": draft.recipient_linkedin_url,
            "email_subject": draft.email_subject,
            "email_body": draft.email_body,
            "linkedin_message": draft.linkedin_message,
            "job_title": draft.job_title,
            "company_name": draft.company_name,
            "recruiter_info": draft.recruiter_info,
            "is_sent": draft.is_sent,
            "email_sent": draft.email_sent,
            "linkedin_sent": draft.linkedin_sent,
            "sent_at": draft.sent_at.isoformat() if draft.sent_at else None,
            "email_sent_at": draft.email_sent_at.isoformat() if draft.email_sent_at else None,
            "linkedin_sent_at": draft.linkedin_sent_at.isoformat() if draft.linkedin_sent_at else None,
            "created_at": draft.created_at.isoformat(),
            "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        }
    }


@router.put("/drafts/{draft_id}")
async def update_draft(
    draft_id: int,
    request: DraftUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Update a draft."""
    result = await db.execute(
        select(Draft)
        .where(Draft.id == draft_id)
        .where(Draft.owner_id == current_user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Prevent updating parts that have already been sent
    if request.email_subject is not None and draft.email_sent:
        raise HTTPException(status_code=400, detail="Cannot update email that has already been sent")
    if request.email_body is not None and draft.email_sent:
        raise HTTPException(status_code=400, detail="Cannot update email that has already been sent")
    if request.linkedin_message is not None and draft.linkedin_sent:
        raise HTTPException(status_code=400, detail="Cannot update LinkedIn message that has already been sent")
    
    # Update fields
    if request.draft_type is not None:
        draft.draft_type = request.draft_type
    if request.recipient_name is not None:
        draft.recipient_name = request.recipient_name
    if request.recipient_email is not None:
        draft.recipient_email = request.recipient_email
    if request.recipient_linkedin_url is not None:
        draft.recipient_linkedin_url = request.recipient_linkedin_url
    if request.email_subject is not None:
        draft.email_subject = request.email_subject
    if request.email_body is not None:
        draft.email_body = request.email_body
    if request.linkedin_message is not None:
        draft.linkedin_message = request.linkedin_message
    if request.job_title is not None:
        draft.job_title = request.job_title
    if request.company_name is not None:
        draft.company_name = request.company_name
    if request.recruiter_info is not None:
        draft.recruiter_info = request.recruiter_info
    
    draft.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(draft)
    
    return {
        "success": True,
        "draft": {
            "id": draft.id,
            "draft_type": draft.draft_type,
            "recipient_name": draft.recipient_name,
            "recipient_email": draft.recipient_email,
            "recipient_linkedin_url": draft.recipient_linkedin_url,
            "email_subject": draft.email_subject,
            "email_body": draft.email_body,
            "linkedin_message": draft.linkedin_message,
            "job_title": draft.job_title,
            "company_name": draft.company_name,
            "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        }
    }


@router.post("/drafts/{draft_id}/send")
async def send_draft(
    draft_id: int,
    request: DraftSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Send a draft (email and/or LinkedIn)."""
    import logging
    logger = logging.getLogger(__name__)
    
    result = await db.execute(
        select(Draft)
        .where(Draft.id == draft_id)
        .where(Draft.owner_id == current_user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    logger.info(f"Sending draft {draft_id}: send_email={request.send_email}, send_linkedin={request.send_linkedin}")
    
    # Check if the specific part being sent is already sent
    if request.send_email and draft.email_sent:
        raise HTTPException(status_code=400, detail="Email has already been sent")
    if request.send_linkedin and draft.linkedin_sent:
        raise HTTPException(status_code=400, detail="LinkedIn message has already been sent")
    
    results = {
        "email": None,
        "linkedin": None
    }
    
    # Send email if requested and draft has email content
    if request.send_email and draft.email_subject and draft.email_body and draft.recipient_email:
        try:
            # Get user's default active email account
            result = await db.execute(
                select(EmailAccount)
                .where(EmailAccount.owner_id == current_user.id)
                .where(EmailAccount.is_active == True)
                .where(EmailAccount.is_default == True)
                .limit(1)
            )
            email_account = result.scalar_one_or_none()
            
            # If no default, get any active account
            if not email_account:
                result = await db.execute(
                    select(EmailAccount)
                    .where(EmailAccount.owner_id == current_user.id)
                    .where(EmailAccount.is_active == True)
                    .limit(1)
                )
                email_account = result.scalar_one_or_none()
            
            if not email_account:
                results["email"] = {
                    "success": False,
                    "error": "No linked email account found. Please link an email account in Settings."
                }
            else:
                # Update last_used_at
                email_account.last_used_at = datetime.utcnow()
                await db.commit()
                
                email_result = await send_email(
                    draft.recipient_email,
                    draft.email_subject,
                    draft.email_body,
                    email_account=email_account,
                    db=db
                )
                results["email"] = email_result
        except Exception as e:
            results["email"] = {
                "success": False,
                "error": str(e)
            }
    
    # Send LinkedIn if requested and draft has LinkedIn content
    if request.send_linkedin:
        if not draft.linkedin_message:
            logger.warning(f"Draft {draft_id} requested LinkedIn send but has no linkedin_message")
        if not draft.recipient_linkedin_url:
            logger.warning(f"Draft {draft_id} requested LinkedIn send but has no recipient_linkedin_url")
    
    if request.send_linkedin and draft.linkedin_message and draft.recipient_linkedin_url:
        try:
            # First, get the user's active Unipile account ID (needed for URL conversion)
            from app.db.models.linkedin_account import LinkedInAccount
            from app.core.config import settings
            from app.services.unified_messenger.adapter import linkedin_url_to_provider_id
            
            unipile_account_id = None
            result = await db.execute(
                select(LinkedInAccount)
                .where(LinkedInAccount.owner_id == current_user.id)
                .where(LinkedInAccount.is_active == True)
                .where(LinkedInAccount.unipile_account_id.isnot(None))
                .order_by(LinkedInAccount.is_default.desc(), LinkedInAccount.created_at.desc())
                .limit(1)
            )
            linkedin_account = result.scalar_one_or_none()
            
            if linkedin_account and linkedin_account.unipile_account_id:
                unipile_account_id = linkedin_account.unipile_account_id
                logger.info(f"Using user's Unipile account for URL conversion: {unipile_account_id}")
            else:
                # Fall back to default
                unipile_account_id = settings.unipile_account_id
                logger.info(f"Using default Unipile account for URL conversion: {unipile_account_id}")
            
            # Convert LinkedIn URL to provider_id
            logger.info(f"Converting LinkedIn URL to provider_id: {draft.recipient_linkedin_url}")
            provider_result = await linkedin_url_to_provider_id(draft.recipient_linkedin_url, account_id=unipile_account_id)
            provider_id = provider_result.get("provider_id")
            
            if not provider_id:
                error_msg = provider_result.get("error", "Could not convert LinkedIn URL to Provider ID")
                logger.error(f"Failed to convert LinkedIn URL to provider_id: {draft.recipient_linkedin_url}. Error: {error_msg}")
                results["linkedin"] = {
                    "success": False,
                    "error": f"{error_msg}. Please check the LinkedIn URL is valid and try again."
                }
            else:
                logger.info(f"Successfully converted to provider_id: {provider_id}")
                
                # Now send the invitation with the provider_id
                linkedin_result = await send_invitation(
                    provider_id=provider_id,
                    text=draft.linkedin_message,
                    user_id=current_user.id,
                    db=db,
                    linkedin_url=draft.recipient_linkedin_url
                )
                results["linkedin"] = linkedin_result
        except Exception as e:
            import traceback
            logger.error(f"Error sending LinkedIn message from draft: {str(e)}")
            logger.error(traceback.format_exc())
            results["linkedin"] = {
                "success": False,
                "error": str(e)
            }
    
    # Mark individual parts as sent if they were sent successfully
    email_success = results["email"] and results["email"].get("success")
    linkedin_success = results["linkedin"] and results["linkedin"].get("success")
    
    if email_success:
        draft.email_sent = True
        draft.email_sent_at = datetime.utcnow()
    
    if linkedin_success:
        draft.linkedin_sent = True
        draft.linkedin_sent_at = datetime.utcnow()
    
    # Mark draft as fully sent only if all applicable parts are sent
    email_needed = draft.draft_type in ['email', 'both'] and draft.email_subject and draft.email_body and draft.recipient_email
    linkedin_needed = draft.draft_type in ['linkedin', 'both'] and draft.linkedin_message and draft.recipient_linkedin_url
    
    if email_needed and linkedin_needed:
        # Both email and LinkedIn are needed - mark as sent only when both are sent
        draft.is_sent = draft.email_sent and draft.linkedin_sent
    elif email_needed:
        # Only email is needed
        draft.is_sent = draft.email_sent
    elif linkedin_needed:
        # Only LinkedIn is needed
        draft.is_sent = draft.linkedin_sent
    else:
        # Neither is needed (shouldn't happen, but handle it)
        draft.is_sent = False
    
    # Update sent_at timestamp if the draft is now fully sent
    if draft.is_sent and not draft.sent_at:
        draft.sent_at = datetime.utcnow()
    
    draft.updated_at = datetime.utcnow()
    await db.commit()
    
    return {
        "success": True,
        "results": results,
        "draft": {
            "id": draft.id,
            "is_sent": draft.is_sent,
            "email_sent": draft.email_sent,
            "linkedin_sent": draft.linkedin_sent,
            "sent_at": draft.sent_at.isoformat() if draft.sent_at else None,
            "email_sent_at": draft.email_sent_at.isoformat() if draft.email_sent_at else None,
            "linkedin_sent_at": draft.linkedin_sent_at.isoformat() if draft.linkedin_sent_at else None,
        }
    }


@router.delete("/drafts/{draft_id}")
async def delete_draft(
    draft_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Delete a draft."""
    result = await db.execute(
        select(Draft)
        .where(Draft.id == draft_id)
        .where(Draft.owner_id == current_user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    await db.execute(delete(Draft).where(Draft.id == draft_id))
    await db.commit()
    
    return {"message": "Draft deleted successfully"}

