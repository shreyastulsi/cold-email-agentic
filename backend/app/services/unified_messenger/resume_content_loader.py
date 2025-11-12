"""Helper functions to load resume content from database."""
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models.resume_content import ResumeContent


async def get_resume_content_from_db(
    owner_id: str,
    db: AsyncSession
) -> Optional[str]:
    """
    Get resume content from database for a user.
    
    Args:
        owner_id: User ID
        db: Database session
        
    Returns:
        Resume content string or None if not found
    """
    try:
        result = await db.execute(
            select(ResumeContent).where(ResumeContent.owner_id == owner_id)
        )
        resume_content = result.scalar_one_or_none()
        
        if resume_content:
            return resume_content.content
        
        return None
    except Exception as e:
        print(f"⚠️  Error loading resume content from database: {e}")
        return None


async def get_resume_with_structured_data(
    owner_id: str,
    db: AsyncSession
) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Get resume content AND structured data from database for a user.
    
    Args:
        owner_id: User ID
        db: Database session
        
    Returns:
        Tuple of (resume_content_string, structured_data_dict) or (None, None) if not found
    """
    try:
        result = await db.execute(
            select(ResumeContent).where(ResumeContent.owner_id == owner_id)
        )
        resume_content = result.scalar_one_or_none()
        
        if resume_content:
            return resume_content.content, resume_content.structured_data
        
        return None, None
    except Exception as e:
        print(f"⚠️  Error loading resume content from database: {e}")
        return None, None

