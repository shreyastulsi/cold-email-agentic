from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.base import get_db
from app.db.models.email_account import EmailAccount
from app.db.models.linkedin_account import LinkedInAccount
from app.db.models.resume_content import ResumeContent
from app.db.models.user import User

router = APIRouter()


@router.get("/onboarding/status")
async def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return onboarding readiness flags for the current user."""

    resume_result = await db.execute(
        select(ResumeContent.id).where(ResumeContent.owner_id == current_user.id)
    )
    has_resume = resume_result.first() is not None

    email_result = await db.execute(
        select(EmailAccount.id).where(EmailAccount.owner_id == current_user.id)
    )
    has_email = email_result.first() is not None

    linkedin_result = await db.execute(
        select(LinkedInAccount.id).where(LinkedInAccount.owner_id == current_user.id)
    )
    has_linkedin = linkedin_result.first() is not None

    return {
        "has_resume": has_resume,
        "has_email_account": has_email,
        "has_linkedin_account": has_linkedin,
        "is_ready_for_search": has_resume and (has_email or has_linkedin),
    }

