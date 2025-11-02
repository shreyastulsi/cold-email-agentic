"""RecruiterContact model."""
from sqlalchemy import String, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base


class RecruiterContact(Base):
    """Recruiter contact model."""
    
    __tablename__ = "recruiter_contacts"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str] = mapped_column(String)
    profile_url: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)  # e.g., "apollo", "linkedin_search"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    outreach_attempts: Mapped[list] = relationship("OutreachAttempt", back_populates="recruiter")
    
    def __repr__(self):
        return f"<RecruiterContact(id={self.id}, name={self.name}, company={self.company})>"

