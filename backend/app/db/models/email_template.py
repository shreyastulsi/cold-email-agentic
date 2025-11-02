"""EmailTemplate model."""
from sqlalchemy import String, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class EmailTemplate(Base):
    """Email template model."""
    
    __tablename__ = "email_templates"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    body_markdown: Mapped[Text] = mapped_column(Text, nullable=False)
    variables: Mapped[str] = mapped_column(Text)  # JSON string of variables
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    
    def __repr__(self):
        return f"<EmailTemplate(id={self.id}, name={self.name})>"

