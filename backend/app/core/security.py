"""Supabase JWT verification."""
import jwt
from typing import Optional, Dict
from fastapi import HTTPException, status
from app.core.config import settings


def verify_supabase_jwt(token: str) -> Dict:
    """
    Verify Supabase JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException if token is invalid
    """
    try:
        if not settings.supabase_jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT secret not configured"
            )
        
        # Remove 'Bearer ' prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        
        # Verify and decode token
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )


def get_user_id_from_token(token: str) -> str:
    """
    Extract user ID from JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        User ID (sub claim)
    """
    payload = verify_supabase_jwt(token)
    return payload.get("sub", "")


def get_email_from_token(token: str) -> Optional[str]:
    """
    Extract email from JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Email address or None
    """
    payload = verify_supabase_jwt(token)
    return payload.get("email")

