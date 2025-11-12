"""ResumeContent model."""
from sqlalchemy import String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from app.db.base import Base


class ResumeContent(Base):
    """Resume content model - stores extracted resume text and parsed structured data."""
    
    __tablename__ = "resume_content"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, unique=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Extracted resume text
    structured_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Parsed resume data (name, education, experience, technologies, etc.)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ResumeContent(id={self.id}, owner_id={self.owner_id}, content_length={len(self.content) if self.content else 0})>"

