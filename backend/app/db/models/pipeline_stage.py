"""PipelineStage model."""
from sqlalchemy import String, ForeignKey, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base


class PipelineStage(Base):
    """Pipeline stage model."""
    
    __tablename__ = "pipeline_stages"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    
    def __repr__(self):
        return f"<PipelineStage(id={self.id}, name={self.name}, order_index={self.order_index})>"

