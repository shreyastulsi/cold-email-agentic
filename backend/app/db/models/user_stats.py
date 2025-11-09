"""User statistics model to track dashboard metrics per user."""
from sqlalchemy import String, ForeignKey, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from app.db.base import Base


class UserStats(Base):
    """User statistics - tracks dashboard metrics and application history per user."""
    
    __tablename__ = "user_stats"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Dashboard statistics
    linkedin_invites_sent: Mapped[int] = mapped_column(Integer, default=0)
    emails_sent: Mapped[int] = mapped_column(Integer, default=0)
    roles_reached: Mapped[int] = mapped_column(Integer, default=0)
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    
    # Latest activity tracking
    last_linkedin_invite_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_email_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_application_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<UserStats(user_id={self.user_id}, invites={self.linkedin_invites_sent}, emails={self.emails_sent}, roles={self.roles_reached})>"

