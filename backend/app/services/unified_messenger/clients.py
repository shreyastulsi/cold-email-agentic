"""Factory for creating UnifiedMessenger instances."""
import os
import sys
from typing import Optional
from app.core.config import settings

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

# Import UnifiedMessenger
from .unified_messenger import UnifiedMessenger


_messenger_instance: Optional[UnifiedMessenger] = None


def get_messenger() -> UnifiedMessenger:
    """
    Get or create UnifiedMessenger instance (singleton-like).
    
    Returns:
        UnifiedMessenger instance
    """
    global _messenger_instance
    
    if _messenger_instance is None:
        # Ensure environment variables are set from settings
        os.environ["UNIPILE_API_KEY"] = settings.unipile_api_key
        os.environ["APOLLO_API_KEY"] = settings.apollo_api_key
        os.environ["BASE_URL"] = settings.base_url
        os.environ["UNIPILE_ACCOUNT_ID"] = settings.unipile_account_id
        os.environ["SMTP_SERVER"] = settings.smtp_server
        os.environ["SMTP_PORT"] = str(settings.smtp_port)
        os.environ["SMTP_USERNAME"] = settings.smtp_username
        os.environ["SMTP_PASSWORD"] = settings.smtp_password
        os.environ["FROM_EMAIL"] = settings.from_email
        os.environ["OPENAI_API_KEY"] = settings.openai_api_key
        
        _messenger_instance = UnifiedMessenger()
    
    return _messenger_instance

