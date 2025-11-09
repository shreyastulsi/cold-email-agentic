"""Outreach History model - permanent record of all sent messages."""
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class OutreachHistory(Base):
    """
    Permanent record of all sent outreach messages.
    This table is independent of drafts - deleting drafts doesn't affect history.
    """
    __tablename__ = "outreach_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Recipient information
    recipient_name: Mapped[str] = mapped_column(String, nullable=True)
    recipient_email: Mapped[str] = mapped_column(String, nullable=True)
    recipient_linkedin_url: Mapped[str] = mapped_column(String, nullable=True)
    
    # Job/Company information
    job_title: Mapped[str] = mapped_column(String, nullable=True)
    company_name: Mapped[str] = mapped_column(String, nullable=True)
    
    # Channel information
    channel: Mapped[str] = mapped_column(String, nullable=False)  # 'email', 'linkedin', or 'both'
    
    # Message content (optional, for reference)
    email_subject: Mapped[str] = mapped_column(String, nullable=True)
    email_body: Mapped[str] = mapped_column(Text, nullable=True)
    linkedin_message: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Timestamps
    sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Optional: link back to draft if it still exists
    draft_id: Mapped[int] = mapped_column(Integer, nullable=True)

    def __repr__(self):
        return f"<OutreachHistory(id={self.id}, user_id={self.user_id}, channel={self.channel}, recipient={self.recipient_name})>"

