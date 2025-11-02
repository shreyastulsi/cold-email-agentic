"""FastAPI dependencies."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.security import verify_supabase_jwt, get_user_id_from_token, get_email_from_token
from app.db.base import get_db
from app.db.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user.
    Auto-creates user record if it doesn't exist.
    
    Args:
        credentials: HTTP Bearer token
        db: Database session
        
    Returns:
        User instance
        
    Raises:
        HTTPException if authentication fails
    """
    token = credentials.credentials
    
    # Verify JWT token
    verify_supabase_jwt(token)
    
    # Extract user info from token
    user_id = get_user_id_from_token(token)
    email = get_email_from_token(token)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )
    
    # Get or create user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # Auto-create user record
        user = User(id=user_id, email=email or "")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    return user

