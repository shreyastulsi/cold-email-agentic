"""User model."""
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class User(Base):
    """User model - auto-created from Supabase auth."""
    
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)  # Supabase user ID
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"

