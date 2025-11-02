"""Pipeline endpoints."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.db.models.user import User

router = APIRouter()


@router.get("/pipeline/stages")
async def get_pipeline_stages(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get pipeline stages for current user."""
    # TODO: Implement pipeline stages from DB
    return {
        "stages": [
            {"id": 1, "name": "Prospects", "order_index": 0},
            {"id": 2, "name": "Contacted", "order_index": 1},
            {"id": 3, "name": "Replied", "order_index": 2},
            {"id": 4, "name": "Booked", "order_index": 3}
        ]
    }

