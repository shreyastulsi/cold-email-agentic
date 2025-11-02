"""Email account model."""
from sqlalchemy import String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from app.db.base import Base


class EmailAccount(Base):
    """User's linked email account for sending emails."""
    
    __tablename__ = "email_accounts"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Email account details
    email: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)  # 'gmail', 'outlook', 'custom'
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # OAuth credentials (for Gmail/Outlook)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted refresh token
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Temporary access token
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # SMTP credentials (for custom providers or App Passwords)
    smtp_server: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(String, nullable=True)
    smtp_username: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    smtp_password: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # Default account for sending
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<EmailAccount(id={self.id}, owner_id={self.owner_id}, email={self.email}, provider={self.provider})>"

