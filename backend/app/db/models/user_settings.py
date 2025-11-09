"""User settings model to track active accounts and preferences."""
from sqlalchemy import String, ForeignKey, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import Optional
from app.db.base import Base


class UserSettings(Base):
    """User settings - tracks active email and LinkedIn accounts per user."""
    
    __tablename__ = "user_settings"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Active account IDs (foreign keys to email_accounts and linkedin_accounts)
    # ondelete='SET NULL' allows deletion of accounts while keeping user_settings
    active_email_account_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("email_accounts.id", ondelete='SET NULL'), nullable=True)
    active_linkedin_account_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("linkedin_accounts.id", ondelete='SET NULL'), nullable=True)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<UserSettings(user_id={self.user_id}, active_email={self.active_email_account_id}, active_linkedin={self.active_linkedin_account_id})>"

