"""Draft model for storing unsent outreach messages."""
from sqlalchemy import String, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional, Dict, Any
from app.db.base import Base


class Draft(Base):
    """Draft messages for emails and LinkedIn invitations."""
    
    __tablename__ = "drafts"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Draft type: 'email', 'linkedin', or 'both'
    draft_type: Mapped[str] = mapped_column(String, nullable=False)  # 'email', 'linkedin', 'both'
    
    # Recipient information
    recipient_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    recipient_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    recipient_linkedin_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Email draft content
    email_subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_body: Mapped[Optional[Text]] = mapped_column(Text, nullable=True)
    
    # LinkedIn draft content
    linkedin_message: Mapped[Optional[Text]] = mapped_column(Text, nullable=True)
    
    # Metadata
    job_title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    recruiter_info: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Store full recruiter object
    
    # Status
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    email_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    linkedin_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    linkedin_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Draft(id={self.id}, owner_id={self.owner_id}, draft_type={self.draft_type})>"

