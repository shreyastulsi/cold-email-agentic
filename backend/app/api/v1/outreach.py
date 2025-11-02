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
    
    return await send_email(
        request.to,
        request.subject,
        request.body,
        email_account=email_account
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
    current_user: User = Depends(get_current_user)
) -> dict:
    """Send LinkedIn connection invitation."""
    try:
        result = await send_linkedin_invitation(
            request.linkedin_url,
            request.message
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invitation sending failed: {str(e)}")

