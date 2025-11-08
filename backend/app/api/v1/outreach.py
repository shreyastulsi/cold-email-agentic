"""Outreach endpoints."""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.base import get_db
from app.db.models.email_account import EmailAccount
from sqlalchemy import select
from app.services.unified_messenger.adapter import (
    extract_emails_for_recruiters,
    generate_email,
    send_email,
    email_only_outreach,
    enhanced_dual_outreach,
    generate_linkedin_message,
    send_linkedin_invitation
)
from app.services.unified_messenger.resume_content_loader import get_resume_content_from_db

router = APIRouter()


class ExtractEmailsRequest(BaseModel):
    recruiters: List[dict]


class GenerateEmailRequest(BaseModel):
    job_titles: List[str]
    job_type: str
    recruiter: dict


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str


class EmailOnlyCampaignRequest(BaseModel):
    recruiters: List[dict]
    job_titles: List[str]
    job_type: str


class DualOutreachCampaignRequest(BaseModel):
    recruiters: List[dict]
    job_titles: List[str]
    job_type: str


@router.post("/outreach/emails/extract")
async def extract_emails(
    request: ExtractEmailsRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Extract emails for recruiters."""
    recruiters_with_emails = await extract_emails_for_recruiters(request.recruiters)
    return {"recruiters": recruiters_with_emails}


@router.post("/outreach/email/generate")
async def generate_email_endpoint(
    request: GenerateEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Generate email content."""
    # Get resume content from database (user's edited version)
    resume_content = await get_resume_content_from_db(current_user.id, db)
    
    return await generate_email(
        request.job_titles,
        request.job_type,
        request.recruiter,
        resume_content
    )


@router.post("/outreach/email/send")
async def send_email_endpoint(
    request: SendEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Send email using the user's linked email account."""
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
            raise HTTPException(
                status_code=400,
                detail="No linked email account found. Please link an email account in Settings."
            )
        
        # Update last_used_at
        from datetime import datetime
        email_account.last_used_at = datetime.utcnow()
        await db.commit()
        
        result = await send_email(
            request.to,
            request.subject,
            request.body,
            email_account=email_account,
            db=db
        )
        
        # Ensure we return the proper format
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the error and return a proper error response
        import traceback
        print(f"Error sending email: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(e)}"
        )


@router.post("/outreach/campaign/email-only")
async def email_only_campaign(
    request: EmailOnlyCampaignRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Execute email-only outreach campaign."""
    # TODO: In production, track campaign in DB and use background tasks properly
    summary = await email_only_outreach(
        request.recruiters,
        request.job_titles,
        request.job_type
    )
    return summary


@router.post("/outreach/campaign/dual")
async def dual_outreach_campaign(
    request: DualOutreachCampaignRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Execute enhanced dual outreach campaign."""
    # TODO: In production, track campaign in DB and use background tasks properly
    summary = await enhanced_dual_outreach(
        request.recruiters,
        request.job_titles,
        request.job_type
    )
    return summary


class GenerateLinkedInMessageRequest(BaseModel):
    recruiter: dict
    job_title: str
    company_name: str
    resume_file: Optional[str] = "Resume-Tulsi,Shreyas.pdf"


class SendLinkedInInvitationRequest(BaseModel):
    linkedin_url: str
    message: str


@router.post("/outreach/linkedin/generate")
async def generate_linkedin_message_endpoint(
    request: GenerateLinkedInMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Generate LinkedIn message for a recruiter-job pair."""
    try:
        # Get resume content from database (user's edited version)
        resume_content = await get_resume_content_from_db(current_user.id, db)
        
        message = await generate_linkedin_message(
            request.recruiter,
            request.job_title,
            request.company_name,
            resume_content=resume_content,
            resume_file=request.resume_file  # Fallback if DB content not available
        )
        return {
            "message": message,
            "length": len(message)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Message generation failed: {str(e)}")


@router.post("/outreach/linkedin/send")
async def send_linkedin_invitation_endpoint(
    request: SendLinkedInInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Send LinkedIn connection invitation. Uses LinkedIn OAuth if available, otherwise falls back to Unipile."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # First, get the user's active Unipile account ID (needed for URL conversion)
        from app.db.models.linkedin_account import LinkedInAccount
        from sqlalchemy import select
        from app.core.config import settings
        
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
        
        # Convert LinkedIn URL to provider_id using Unipile
        from app.services.unified_messenger.adapter import linkedin_url_to_provider_id
        logger.info(f"Converting LinkedIn URL to provider_id: {request.linkedin_url}")
        provider_result = await linkedin_url_to_provider_id(request.linkedin_url, account_id=unipile_account_id)
        provider_id = provider_result.get("provider_id")
        
        if not provider_id:
            error_msg = provider_result.get("error", "Could not convert LinkedIn URL to Provider ID")
            logger.error(f"Failed to convert LinkedIn URL to provider_id: {request.linkedin_url}. Error: {error_msg}")
            raise HTTPException(
                status_code=404, 
                detail=f"{error_msg}. Please check the LinkedIn URL is valid and try again."
            )
        
        logger.info(f"Successfully converted to provider_id: {provider_id}")
        
        # Use the send_invitation function which handles OAuth fallback
        from app.services.unified_messenger.adapter import send_invitation
        logger.info(f"Sending LinkedIn invitation to provider_id: {provider_id} for user: {current_user.id}")
        result = await send_invitation(
            provider_id,
            request.message,
            user_id=current_user.id,
            db=db,
            linkedin_url=request.linkedin_url
        )
        
        # Check if the result indicates failure
        if not result.get("success", False):
            error_msg = result.get("error", "Unknown error")
            logger.error(f"Failed to send LinkedIn invitation: {error_msg}")
            # Return proper error response
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        logger.info(f"Successfully sent LinkedIn invitation")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error sending LinkedIn invitation: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"Invitation sending failed: {str(e)}"
        )

