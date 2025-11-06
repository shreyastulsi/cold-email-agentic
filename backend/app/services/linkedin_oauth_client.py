"""LinkedIn OAuth API client for sending messages and invitations."""
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class LinkedInOAuthClient:
    """Client for interacting with LinkedIn API using OAuth tokens."""
    
    def __init__(self, access_token: str, refresh_token: Optional[str] = None):
        """
        Initialize LinkedIn OAuth client.
        
        Args:
            access_token: LinkedIn OAuth access token
            refresh_token: Optional refresh token for token renewal
        """
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.base_url = "https://api.linkedin.com/v2"
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for LinkedIn API requests."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }
    
    def refresh_access_token(self, client_id: str, client_secret: str) -> Optional[str]:
        """
        Refresh the access token using refresh token.
        
        Args:
            client_id: LinkedIn OAuth client ID
            client_secret: LinkedIn OAuth client secret
            
        Returns:
            New access token if successful, None otherwise
        """
        if not self.refresh_token:
            return None
        
        try:
            token_data = {
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            }
            
            response = httpx.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30.0
            )
            
            if response.status_code == 200:
                tokens = response.json()
                new_access_token = tokens.get('access_token')
                if new_access_token:
                    self.access_token = new_access_token
                    return new_access_token
            
            return None
        except Exception as e:
            logger.error(f"Error refreshing LinkedIn token: {e}")
            return None
    
    def get_profile_id_from_url(self, profile_url: str) -> Optional[str]:
        """
        Get the actual LinkedIn profile ID (URN) from a profile URL.
        This requires making an API call to LinkedIn's profile lookup endpoint.
        
        Args:
            profile_url: LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)
            
        Returns:
            Profile URN if found, None otherwise
        """
        try:
            # Extract username from URL
            if "/in/" in profile_url:
                username = profile_url.split("/in/")[1].split("/")[0].split("?")[0]
            else:
                return None
            
            # Try to get profile info using LinkedIn's People API
            # First, try to get basic profile info
            # Note: LinkedIn API permissions may limit what we can access
            # For connection requests, we may need the person's URN
            
            # LinkedIn's profile lookup endpoint
            # This might require additional permissions
            response = httpx.get(
                f"{self.base_url}/people/(vanityName:{username})",
                headers=self._get_headers(),
                timeout=30.0
            )
            
            if response.status_code == 200:
                profile_data = response.json()
                # Extract the URN from the response
                # The exact structure depends on LinkedIn's API response
                if "id" in profile_data:
                    return profile_data["id"]
            
            # If that doesn't work, return None and the caller will handle fallback
            return None
            
        except Exception as e:
            logger.warning(f"Could not get profile ID from URL: {e}")
            return None
    
    def get_profile_urn_from_url(self, profile_url: str) -> Optional[str]:
        """
        Get LinkedIn profile URN from URL by making API call.
        
        Args:
            profile_url: LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)
            
        Returns:
            Profile URN if found, None otherwise
        """
        try:
            # Extract username from URL
            if "/in/" in profile_url:
                username = profile_url.split("/in/")[1].split("/")[0].split("?")[0]
            else:
                return None
            
            # Try to get profile URN using LinkedIn API
            # First try the people endpoint
            try:
                response = httpx.get(
                    f"{self.base_url}/people/(vanityName:{username})",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    profile_data = response.json()
                    # Profile URN should be in the response
                    if "id" in profile_data:
                        return profile_data["id"]
            except Exception as e:
                logger.warning(f"Could not get profile URN from API: {e}")
            
            return None
        except Exception as e:
            logger.error(f"Error extracting profile URN: {e}")
            return None
    
    def send_connection_request(self, profile_url: str, message: str = "") -> Dict[str, Any]:
        """
        Send a LinkedIn connection request or message.
        
        Note: LinkedIn's API doesn't directly support connection requests programmatically.
        We'll try to send via messaging API which may work for InMail or existing connections.
        
        Args:
            profile_url: LinkedIn profile URL
            message: Invitation/message text
            
        Returns:
            Dict with success status and result/error
        """
        try:
            # Get profile URN from URL
            profile_urn = self.get_profile_urn_from_url(profile_url)
            
            if not profile_urn:
                # If we can't get URN, try to construct it from username
                if "/in/" in profile_url:
                    username = profile_url.split("/in/")[1].split("/")[0].split("?")[0]
                    profile_urn = f"urn:li:fs_profile:(ACoAAA{username})"
                else:
                    return {
                        "success": False,
                        "error": "Could not extract profile identifier from LinkedIn URL"
                    }
            
            # LinkedIn messaging API endpoint for sending messages
            # This works for existing connections and InMail
            # For connection requests, LinkedIn doesn't provide a direct API endpoint
            
            # Try to create a conversation and send message
            # LinkedIn's messaging API structure:
            # 1. Create or get conversation
            # 2. Send message to conversation
            
            # For now, try the simplified approach
            # Note: This requires the user to have permission to message the recipient
            # (either connected or has InMail credits)
            
            payload = {
                "recipients": [profile_urn],
                "subject": message[:200] if message else "Connection request",
                "body": message if message else "I'd like to connect with you on LinkedIn.",
            }
            
            # Try LinkedIn messaging API
            # Endpoint: POST /messaging/conversations
            response = httpx.post(
                f"{self.base_url}/messaging/conversations",
                json=payload,
                headers=self._get_headers(),
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                return {
                    "success": True,
                    "result": response.json() if response.text else {"status": "sent"}
                }
            else:
                error_text = response.text
                logger.error(f"Failed to send message/invitation: {response.status_code} - {error_text}")
                
                # If it's a 403 or similar, might be because we're not connected
                # LinkedIn API doesn't support connection requests programmatically
                if response.status_code == 403:
                    return {
                        "success": False,
                        "error": "LinkedIn API doesn't support sending connection requests programmatically. You can only message existing connections or use InMail credits."
                    }
                
                return {
                    "success": False,
                    "error": f"Failed to send message: {response.status_code} - {error_text}"
                }
                
        except Exception as e:
            logger.error(f"Error sending connection request: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def send_message_to_connection(self, profile_urn: str, message: str) -> Dict[str, Any]:
        """
        Send a message to an existing LinkedIn connection.
        
        Args:
            profile_urn: LinkedIn profile URN (urn:li:fs_profile:{profile_id})
            message: Message text
            
        Returns:
            Dict with success status and result/error
        """
        try:
            # LinkedIn messaging API requires first getting or creating a conversation
            # Then sending a message to that conversation
            
            # Step 1: Create or get conversation
            payload = {
                "recipients": [profile_urn],
                "subject": message[:200] if len(message) > 200 else message,
            }
            
            response = httpx.post(
                f"{self.base_url}/messaging/conversations",
                json=payload,
                headers=self._get_headers(),
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                conversation_data = response.json()
                conversation_id = conversation_data.get("id")
                
                # Step 2: Send message to conversation
                if conversation_id:
                    message_payload = {
                        "body": {
                            "text": message
                        }
                    }
                    
                    message_response = httpx.post(
                        f"{self.base_url}/messaging/conversations/{conversation_id}/messages",
                        json=message_payload,
                        headers=self._get_headers(),
                        timeout=30.0
                    )
                    
                    if message_response.status_code in [200, 201]:
                        return {
                            "success": True,
                            "result": message_response.json() if message_response.text else {"status": "sent"}
                        }
                    else:
                        error_text = message_response.text
                        logger.error(f"Failed to send message: {message_response.status_code} - {error_text}")
                        return {
                            "success": False,
                            "error": f"Failed to send message: {error_text}"
                        }
                
                # If no conversation ID, try simplified approach
                return {
                    "success": True,
                    "result": conversation_data
                }
            else:
                error_text = response.text
                logger.error(f"Failed to create conversation: {response.status_code} - {error_text}")
                return {
                    "success": False,
                    "error": f"Failed to create conversation: {error_text}"
                }
                
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return {
                "success": False,
                "error": str(e)
            }

