"""OutreachAttempt model."""
from sqlalchemy import String, ForeignKey, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base


class OutreachAttempt(Base):
    """Outreach attempt model."""
    
    __tablename__ = "outreach_attempts"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    recruiter_id: Mapped[int] = mapped_column(Integer, ForeignKey("recruiter_contacts.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String, nullable=False)  # "linkedin", "email"
    status: Mapped[str] = mapped_column(String, default="pending")  # "pending", "sent", "failed", "replied"
    subject: Mapped[str] = mapped_column(String, nullable=True)
    body: Mapped[Text] = mapped_column(Text, nullable=True)
    response_json: Mapped[str] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    recruiter: Mapped["RecruiterContact"] = relationship("RecruiterContact", back_populates="outreach_attempts")
    
    def __repr__(self):
        return f"<OutreachAttempt(id={self.id}, recruiter_id={self.recruiter_id}, channel={self.channel}, status={self.status})>"

