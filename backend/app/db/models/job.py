"""Job model."""
from sqlalchemy import String, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class Job(Base):
    """Job model."""
    
    __tablename__ = "jobs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    
    def __repr__(self):
        return f"<Job(id={self.id}, title={self.title}, company={self.company})>"

