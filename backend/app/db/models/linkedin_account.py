"""LinkedIn account model."""
from sqlalchemy import String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from app.db.base import Base


class LinkedInAccount(Base):
    """User's linked LinkedIn account for sending messages and invitations."""
    
    __tablename__ = "linkedin_accounts"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # LinkedIn account details
    linkedin_profile_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    profile_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Unipile integration
    unipile_account_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Unipile account ID for this LinkedIn account
    
    # OAuth credentials
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted refresh token
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Temporary access token
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # Default account for sending
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<LinkedInAccount(id={self.id}, owner_id={self.owner_id}, profile_id={self.profile_id})>"

