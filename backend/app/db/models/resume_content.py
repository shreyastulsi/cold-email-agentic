"""ResumeContent model."""
from sqlalchemy import String, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class ResumeContent(Base):
    """Resume content model - stores extracted resume text."""
    
    __tablename__ = "resume_content"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, unique=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Extracted resume text
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ResumeContent(id={self.id}, owner_id={self.owner_id}, content_length={len(self.content) if self.content else 0})>"

