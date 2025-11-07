"""Company model for caching company name to ID mappings."""
from sqlalchemy import String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class Company(Base):
    """Company cache model - stores company name to Unipile company ID mappings."""
    
    __tablename__ = "companies"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)  # Normalized lowercase name
    company_id: Mapped[str] = mapped_column(String, nullable=False)  # Unipile company ID
    company_data: Mapped[dict] = mapped_column(JSON, nullable=True)  # Full company data from API
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<Company(id={self.id}, company_name={self.company_name}, company_id={self.company_id})>"

