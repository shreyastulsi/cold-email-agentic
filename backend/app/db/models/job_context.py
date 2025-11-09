"""Job context model for storing condensed job requirements/technologies."""
from datetime import datetime
from typing import Optional, List, Any

from sqlalchemy import String, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobContext(Base):
    """Persistent storage for condensed job posting information."""

    __tablename__ = "job_contexts"
    __table_args__ = (
        UniqueConstraint("job_url", name="uq_job_contexts_job_url"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_url: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    condensed_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    technologies: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    responsibilities: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return f"<JobContext(id={self.id}, url={self.job_url}, title={self.title})>"

