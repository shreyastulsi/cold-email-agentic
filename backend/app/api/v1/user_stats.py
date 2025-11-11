"""User statistics endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.base import get_db
from app.services.user_settings_service import (
    get_or_create_user_stats,
    increment_linkedin_invites,
    increment_emails_sent,
    increment_roles_reached,
    increment_total_attempts
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/user-stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get user statistics for dashboard including latest attempts."""
    try:
        from app.db.models.outreach_history import OutreachHistory
        from sqlalchemy import select
        
        user_stats = await get_or_create_user_stats(current_user.id, db)
        
        # Get all outreach history records (we'll consolidate and limit later)
        result = await db.execute(
            select(OutreachHistory)
            .where(OutreachHistory.user_id == current_user.id)
            .order_by(OutreachHistory.sent_at.desc())
        )
        history_records = result.scalars().all()
        
        # Consolidate records by recipient + job + company
        # If same person/job has both email and linkedin, combine into one entry
        consolidated = {}
        
        for record in history_records:
            # Create a key based on recipient, job, company
            key = (
                (record.recipient_name or "").lower().strip(),
                (record.job_title or "").lower().strip(),
                (record.company_name or "").lower().strip()
            )
            
            if key in consolidated:
                # Already have an entry for this person/job - combine channels
                existing = consolidated[key]
                
                # Collect all channels
                existing_channels = set(existing['channels'])
                new_channel = record.channel
                
                # Add new channel(s)
                if new_channel == 'both':
                    existing_channels.add('email')
                    existing_channels.add('linkedin')
                else:
                    existing_channels.add(new_channel)
                
                existing['channels'] = existing_channels
                
                # Keep the most recent timestamp
                if record.sent_at > existing['sent_at']:
                    existing['sent_at'] = record.sent_at
            else:
                # New entry
                channels = set()
                if record.channel == 'both':
                    channels.add('email')
                    channels.add('linkedin')
                else:
                    channels.add(record.channel)
                
                consolidated[key] = {
                    'id': record.id,
                    'sent_at': record.sent_at,
                    'recruiter': record.recipient_name or "Unknown",
                    'company': record.company_name or "Company",
                    'title': record.job_title or "Position",
                    'channels': channels
                }
        
        # Convert to list and sort by timestamp
        consolidated_list = sorted(
            consolidated.values(),
            key=lambda x: x['sent_at'],
            reverse=True
        )
        
        # Take top 20
        consolidated_list = consolidated_list[:20]
        
        # Build latest attempts with consolidated data
        latest_attempts = []
        roles_reached = set()
        companies_reached = set()
        
        for entry in consolidated_list:
            # Format channel display
            channels = sorted(entry['channels'])  # Sort for consistent display
            if 'email' in channels and 'linkedin' in channels:
                channel_display = "Email + LinkedIn"
            elif 'email' in channels:
                channel_display = "Email"
            elif 'linkedin' in channels:
                channel_display = "LinkedIn"
            else:
                channel_display = " + ".join([c.title() for c in channels])
            
            latest_attempts.append({
                "id": entry['id'],
                "time": entry['sent_at'].isoformat(),
                "recruiter": entry['recruiter'],
                "company": entry['company'],
                "title": entry['title'],
                "channel": channel_display,
                "status": "sent"
            })
            
            # Track unique roles reached
            if entry['title'] and entry['title'] != "Position" and entry['company'] and entry['company'] != "Company":
                roles_reached.add((entry['title'], entry['company']))
            if entry['company'] and entry['company'] != "Company":
                companies_reached.add(entry['company'])
        
        # Convert roles to list of dicts
        roles_list = [
            {"role": role, "company": company}
            for role, company in roles_reached
        ]
        
        return {
            "linkedin_invites_sent": user_stats.linkedin_invites_sent,
            "emails_sent": user_stats.emails_sent,
            "roles_reached": user_stats.roles_reached,
            "total_attempts": user_stats.total_attempts,
            "last_linkedin_invite_at": user_stats.last_linkedin_invite_at.isoformat() if user_stats.last_linkedin_invite_at else None,
            "last_email_sent_at": user_stats.last_email_sent_at.isoformat() if user_stats.last_email_sent_at else None,
            "last_application_at": user_stats.last_application_at.isoformat() if user_stats.last_application_at else None,
            "latest_attempts": latest_attempts,
            "roles_reached_list": roles_list,
            "unique_companies_reached": len(companies_reached),
            "unique_companies_list": sorted(companies_reached),
        }
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get user stats: {str(e)}")


@router.post("/user-stats/increment/linkedin-invite")
async def increment_linkedin_invite(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Increment LinkedIn invites sent count."""
    try:
        user_stats = await increment_linkedin_invites(current_user.id, db)
        return {
            "success": True,
            "linkedin_invites_sent": user_stats.linkedin_invites_sent
        }
    except Exception as e:
        logger.error(f"Error incrementing LinkedIn invites: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to increment LinkedIn invites: {str(e)}")


@router.post("/user-stats/increment/email")
async def increment_email(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Increment emails sent count."""
    try:
        user_stats = await increment_emails_sent(current_user.id, db)
        return {
            "success": True,
            "emails_sent": user_stats.emails_sent
        }
    except Exception as e:
        logger.error(f"Error incrementing emails sent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to increment emails sent: {str(e)}")


@router.post("/user-stats/increment/role")
async def increment_role(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Increment roles reached count."""
    try:
        user_stats = await increment_roles_reached(current_user.id, db)
        return {
            "success": True,
            "roles_reached": user_stats.roles_reached
        }
    except Exception as e:
        logger.error(f"Error incrementing roles reached: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to increment roles reached: {str(e)}")


@router.post("/user-stats/reset")
async def reset_user_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Reset all user statistics to zero."""
    try:
        user_stats = await get_or_create_user_stats(current_user.id, db)
        user_stats.linkedin_invites_sent = 0
        user_stats.emails_sent = 0
        user_stats.roles_reached = 0
        user_stats.total_attempts = 0
        user_stats.last_linkedin_invite_at = None
        user_stats.last_email_sent_at = None
        user_stats.last_application_at = None
        from datetime import datetime
        user_stats.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(user_stats)
        
        return {
            "success": True,
            "message": "Statistics reset successfully"
        }
    except Exception as e:
        logger.error(f"Error resetting user stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset user stats: {str(e)}")

