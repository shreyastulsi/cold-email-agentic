"""Service for managing user settings and stats."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.db.models.user_settings import UserSettings
from app.db.models.user_stats import UserStats
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


async def get_or_create_user_settings(user_id: str, db: AsyncSession) -> UserSettings:
    """Get or create user settings for a user."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    user_settings = result.scalar_one_or_none()
    
    if not user_settings:
        user_settings = UserSettings(
            user_id=user_id,
            active_email_account_id=None,
            active_linkedin_account_id=None,
        )
        db.add(user_settings)
        await db.commit()
        await db.refresh(user_settings)
        logger.info(f"Created user_settings for user {user_id}")
    
    return user_settings


async def get_or_create_user_stats(user_id: str, db: AsyncSession) -> UserStats:
    """Get or create user stats for a user."""
    result = await db.execute(
        select(UserStats).where(UserStats.user_id == user_id)
    )
    user_stats = result.scalar_one_or_none()
    
    if not user_stats:
        user_stats = UserStats(
            user_id=user_id,
            linkedin_invites_sent=0,
            emails_sent=0,
            roles_reached=0,
            total_attempts=0,
        )
        db.add(user_stats)
        await db.commit()
        await db.refresh(user_stats)
        logger.info(f"Created user_stats for user {user_id}")
    
    return user_stats


async def set_active_email_account(user_id: str, email_account_id: int, db: AsyncSession) -> UserSettings:
    """Set the active email account for a user."""
    user_settings = await get_or_create_user_settings(user_id, db)
    user_settings.active_email_account_id = email_account_id
    user_settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user_settings)
    logger.info(f"Set active email account {email_account_id} for user {user_id}")
    return user_settings


async def set_active_linkedin_account(user_id: str, linkedin_account_id: int, db: AsyncSession) -> UserSettings:
    """Set the active LinkedIn account for a user."""
    user_settings = await get_or_create_user_settings(user_id, db)
    user_settings.active_linkedin_account_id = linkedin_account_id
    user_settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user_settings)
    logger.info(f"Set active LinkedIn account {linkedin_account_id} for user {user_id}")
    return user_settings


async def increment_linkedin_invites(user_id: str, db: AsyncSession) -> UserStats:
    """Increment LinkedIn invites sent count."""
    user_stats = await get_or_create_user_stats(user_id, db)
    user_stats.linkedin_invites_sent += 1
    user_stats.last_linkedin_invite_at = datetime.utcnow()
    user_stats.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user_stats)
    return user_stats


async def increment_emails_sent(user_id: str, db: AsyncSession) -> UserStats:
    """Increment emails sent count."""
    user_stats = await get_or_create_user_stats(user_id, db)
    user_stats.emails_sent += 1
    user_stats.last_email_sent_at = datetime.utcnow()
    user_stats.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user_stats)
    return user_stats


async def increment_roles_reached(user_id: str, db: AsyncSession) -> UserStats:
    """Increment roles reached count."""
    user_stats = await get_or_create_user_stats(user_id, db)
    user_stats.roles_reached += 1
    user_stats.last_application_at = datetime.utcnow()
    user_stats.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user_stats)
    return user_stats


async def increment_total_attempts(user_id: str, db: AsyncSession) -> UserStats:
    """Increment total attempts count."""
    user_stats = await get_or_create_user_stats(user_id, db)
    user_stats.total_attempts += 1
    user_stats.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user_stats)
    return user_stats

