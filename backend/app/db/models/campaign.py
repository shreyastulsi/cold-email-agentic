"""Campaign model."""
from sqlalchemy import String, ForeignKey, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class Campaign(Base):
    """Campaign model."""
    
    __tablename__ = "campaigns"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    template_id: Mapped[int] = mapped_column(Integer, ForeignKey("email_templates.id"), nullable=True)
    audience_query: Mapped[str] = mapped_column(Text)  # JSON string or query description
    status: Mapped[str] = mapped_column(String, default="draft")  # "draft", "sending", "paused", "completed"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    
    def __repr__(self):
        return f"<Campaign(id={self.id}, name={self.name}, status={self.status})>"

