"""LinkedIn/Unipile endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.api.deps import get_current_user
from app.db.models.user import User
from app.services.unified_messenger.adapter import (
    linkedin_url_to_provider_id,
    find_existing_chat,
    send_message_existing,
    send_message_new,
    send_invitation
)

router = APIRouter()


class LinkedInURLRequest(BaseModel):
    linkedin_url: str


class SearchChatRequest(BaseModel):
    name: str


class MessageRequest(BaseModel):
    text: str


class NewMessageRequest(BaseModel):
    provider_id: str
    text: str
    inmail: Optional[bool] = False


class InvitationRequest(BaseModel):
    provider_id: str
    text: Optional[str] = "I'd like to connect with you on LinkedIn."


@router.post("/linkedin/provider-id")
async def get_provider_id(
    request: LinkedInURLRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Convert LinkedIn URL to Provider ID."""
    result = await linkedin_url_to_provider_id(request.linkedin_url)
    if not result.get("provider_id"):
        raise HTTPException(status_code=404, detail="Could not convert LinkedIn URL to Provider ID")
    return result


@router.post("/linkedin/chats/search")
async def search_chat(
    request: SearchChatRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Search for existing chat by name."""
    return await find_existing_chat(request.name)


@router.post("/linkedin/chats/{chat_id}/messages")
async def send_chat_message(
    chat_id: str,
    request: MessageRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Send message to existing chat."""
    return await send_message_existing(chat_id, request.text)


@router.post("/linkedin/messages/new")
async def send_new_message(
    request: NewMessageRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Send message to new user."""
    return await send_message_new(request.provider_id, request.text, request.inmail)


@router.post("/linkedin/invitations")
async def send_linkedin_invitation(
    request: InvitationRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Send LinkedIn connection invitation."""
    return await send_invitation(request.provider_id, request.text)

