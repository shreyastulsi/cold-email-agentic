"""Email templates endpoints."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_current_user
from app.db.base import get_db
from app.db.models.user import User
from app.db.models.email_template import EmailTemplate

router = APIRouter()


class CreateTemplateRequest(BaseModel):
    name: str
    subject: str
    body_markdown: str
    variables: Optional[dict] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    subject: str
    body_markdown: str
    variables: Optional[dict]
    created_at: str

    class Config:
        from_attributes = True


@router.get("/email/templates")
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """List all email templates for current user."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.owner_id == current_user.id)
    )
    templates = result.scalars().all()
    
    return {
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "subject": t.subject,
                "body_markdown": t.body_markdown,
                "variables": eval(t.variables) if t.variables else None,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in templates
        ]
    }


@router.post("/email/templates")
async def create_template(
    request: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Create a new email template."""
    import json
    
    template = EmailTemplate(
        name=request.name,
        subject=request.subject,
        body_markdown=request.body_markdown,
        variables=json.dumps(request.variables) if request.variables else None,
        owner_id=current_user.id
    )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return {
        "id": template.id,
        "name": template.name,
        "subject": template.subject,
        "body_markdown": template.body_markdown,
        "variables": request.variables,
        "created_at": template.created_at.isoformat() if template.created_at else None
    }

