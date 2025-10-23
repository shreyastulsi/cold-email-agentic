#!/usr/bin/env python3
"""
Unified LinkedIn Messenger - Clean solution for messaging through Unipile
Supports both existing chats and new connections via name or LinkedIn URL
"""

import os
import requests
import re
from dotenv import load_dotenv

load_dotenv()

class UnifiedMessenger:
    def __init__(self):
        self.api_key = os.getenv('UNIPILE_API_KEY')
        self.base_url = "https://api12.unipile.com:14216/api/v1"
        self.account_id = "HZDEVUNPR7yxp0C342K9IA"
        
        self.headers = {
            'X-API-KEY': self.api_key,
            'accept': 'application/json'
        }
        
        if not self.api_key:
            raise ValueError("UNIPILE_API_KEY not found in environment variables")

    def extract_linkedin_identifier(self, linkedin_url):
        """
        Extract the public identifier from a LinkedIn URL.
        Example: https://www.linkedin.com/in/julien-crepieux/ -> julien-crepieux
        """
        # Remove trailing slash and extract the last part
        identifier = linkedin_url.rstrip('/').split('/')[-1]
        return identifier

    def get_provider_id_from_linkedin_url(self, linkedin_url):
        """
        Convert LinkedIn profile URL to Provider ID using Unipile's users endpoint.
        """
        identifier = self.extract_linkedin_identifier(linkedin_url)
        
        print(f"🔍 Converting LinkedIn URL to Provider ID...")
        print(f"📝 URL: {linkedin_url}")
        print(f"🆔 Identifier: {identifier}")
        print("-" * 50)
        
        try:
            # Use the users endpoint with the identifier
            response = requests.get(
                f"{self.base_url}/users/{identifier}",
                headers=self.headers,
                params={'account_id': self.account_id}
            )
            
            if response.status_code == 200:
                result = response.json()
                provider_id = result.get('provider_id')
                name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
                network_distance = result.get('network_distance', 'Unknown')
                
                print(f"✅ Successfully converted!")
                print(f"👤 Name: {name}")
                print(f"🆔 Provider ID: {provider_id}")
                print(f"🔗 Network Distance: {network_distance}")
                
                return provider_id, result
            else:
                print(f"❌ Failed to convert URL")
                print(f"📄 Response: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return None, None

    def find_existing_chat_by_name(self, search_name):
        """
        Find existing chat by searching for a person's name in messages.
        """
        print(f"🔍 Searching for existing chat with '{search_name}'...")
        
        try:
            # Get all chats
            response = requests.get(f"{self.base_url}/chats", headers=self.headers)
            response.raise_for_status()
            chats_data = response.json()
            chats = chats_data.get('items', [])
            
            print(f"📊 Found {len(chats)} total chats")
            
            # Search through each chat's messages
            for i, chat in enumerate(chats):
                chat_id = chat.get('id')
                user_id = chat.get('attendee_provider_id')
                
                try:
                    # Get messages from this chat
                    msg_response = requests.get(
                        f"{self.base_url}/chats/{chat_id}/messages", 
                        headers=self.headers
                    )
                    
                    if msg_response.status_code == 200:
                        messages_data = msg_response.json()
                        messages = messages_data.get('items', [])
                        
                        # Search through messages for the name
                        for message in messages:
                            text = message.get('text', '').lower()
                            
                            if search_name.lower() in text:
                                print(f"✅ Found existing chat with '{search_name}'")
                                print(f"🆔 Chat ID: {chat_id}")
                                print(f"👤 User ID: {user_id}")
                                return chat_id, user_id
                                
                except Exception:
                    continue
            
            print(f"❌ No existing chat found with '{search_name}'")
            return None, None
            
        except Exception as e:
            print(f"❌ Error searching chats: {e}")
            return None, None

    def send_message_to_existing_chat(self, chat_id, message):
        """
        Send message to an existing chat.
        """
        print(f"\n📤 Sending message to existing chat...")
        print(f"🆔 Chat ID: {chat_id}")
        print(f"💬 Message: {message}")
        print("-" * 50)
        
        try:
            response = requests.post(
                f"{self.base_url}/chats/{chat_id}/messages",
                headers=self.headers,
                data={'text': message}
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Message sent successfully!")
                print(f"📨 Message ID: {result.get('id', result.get('message_id', 'Unknown'))}")
                return True, result
            else:
                print(f"❌ Failed to send message")
                return False, response.text
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False, str(e)

    def send_message_to_new_user(self, provider_id, message, use_inmail=False):
        """
        Send message to a new user (creates new chat).
        """
        print(f"\n📤 Sending message to new user...")
        print(f"🆔 Provider ID: {provider_id}")
        print(f"💬 Message: {message}")
        print(f"📧 InMail: {'Yes' if use_inmail else 'No'}")
        print("-" * 50)
        
        data = {
            'account_id': self.account_id,
            'text': message,
            'attendees_ids': provider_id
        }
        
        # Add InMail parameter if requested
        if use_inmail:
            data['linkedin[inmail]'] = 'true'
        
        try:
            response = requests.post(
                f"{self.base_url}/chats",
                headers=self.headers,
                data=data
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Message sent successfully!")
                print(f"📤 Chat ID: {result.get('chat_id', result.get('id', 'Unknown'))}")
                print(f"📨 Message ID: {result.get('message_id', 'Unknown')}")
                return True, result
            else:
                print(f"❌ Failed to send message")
                return False, response.text
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False, str(e)

    def send_invitation(self, provider_id, message="I'd like to connect with you on LinkedIn."):
        """
        Send a LinkedIn connection invitation.
        """
        print(f"\n📨 Sending connection invitation...")
        print(f"🆔 Provider ID: {provider_id}")
        print(f"💬 Message: {message}")
        print("-" * 50)
        
        data = {
            'account_id': self.account_id,
            'provider_id': provider_id,
            'message': message
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/users/invite",
                headers=self.headers,
                json=data
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Invitation sent successfully!")
                print(f"📨 Invitation ID: {result.get('invitation_id', 'Unknown')}")
                return True, result
            else:
                print(f"❌ Failed to send invitation")
                return False, response.text
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False, str(e)

    def is_linkedin_url(self, text):
        """
        Check if the input text is a LinkedIn URL.
        """
        linkedin_pattern = r'https?://(?:www\.)?linkedin\.com/in/[^/\s]+/?'
        return bool(re.match(linkedin_pattern, text.strip()))

    def main(self):
        """
        Main interactive function.
        """
        print("💬 Unified LinkedIn Messenger")
        print("=" * 40)
        print("📝 Options:")
        print("1. Enter a person's name (searches existing chats)")
        print("2. Enter a LinkedIn profile URL (creates new chat)")
        print("3. Send connection invitation")
        print()
        
        # Get user input
        user_input = input("Enter name or LinkedIn URL: ").strip()
        
        if not user_input:
            print("❌ No input provided. Exiting.")
            return
        
        # Determine if it's a LinkedIn URL or name
        if self.is_linkedin_url(user_input):
            print(f"\n🔗 LinkedIn URL detected: {user_input}")
            
            # Convert URL to Provider ID
            provider_id, user_info = self.get_provider_id_from_linkedin_url(user_input)
            
            if not provider_id:
                print("❌ Could not convert LinkedIn URL to Provider ID.")
                return
            
            # Check network distance
            network_distance = user_info.get('network_distance', 'Unknown') if user_info else 'Unknown'
            
            if network_distance == 'FIRST_DEGREE':
                print("✅ This person is a first-degree connection.")
                action = input("\nChoose action:\n1. Send message\n2. Send invitation\nEnter choice (1/2): ").strip()
                
                if action == "1":
                    message = input("Enter your message: ").strip()
                    if message:
                        self.send_message_to_new_user(provider_id, message)
                elif action == "2":
                    message = input("Enter invitation message (or press Enter for default): ").strip()
                    if not message:
                        message = "I'd like to connect with you on LinkedIn."
                    self.send_invitation(provider_id, message)
                else:
                    print("❌ Invalid choice.")
            else:
                print(f"⚠️  This person is {network_distance.lower()} connection.")
                print("💡 Options:")
                print("1. Send InMail (requires Premium LinkedIn)")
                print("2. Send connection invitation")
                
                action = input("Enter choice (1/2): ").strip()
                
                if action == "1":
                    message = input("Enter your InMail message: ").strip()
                    if message:
                        self.send_message_to_new_user(provider_id, message, use_inmail=True)
                elif action == "2":
                    message = input("Enter invitation message (or press Enter for default): ").strip()
                    if not message:
                        message = "I'd like to connect with you on LinkedIn."
                    self.send_invitation(provider_id, message)
                else:
                    print("❌ Invalid choice.")
        
        else:
            print(f"\n👤 Name detected: {user_input}")
            
            # Search for existing chat
            chat_id, user_id = self.find_existing_chat_by_name(user_input)
            
            if chat_id:
                print(f"✅ Found existing chat!")
                message = input("Enter your message: ").strip()
                if message:
                    self.send_message_to_existing_chat(chat_id, message)
            else:
                print(f"❌ No existing chat found with '{user_input}'")
                print("💡 Try using their LinkedIn profile URL instead.")

def main():
    """Entry point for the script."""
    try:
        messenger = UnifiedMessenger()
        messenger.main()
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        print("💡 Make sure to set UNIPILE_API_KEY in your .env file")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    main()
