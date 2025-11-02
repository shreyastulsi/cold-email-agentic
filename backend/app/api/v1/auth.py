"""Authentication endpoints."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.db.models.user import User

router = APIRouter()


@router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)) -> dict:
    """
    Get current authenticated user.
    
    Returns:
        User information
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }

