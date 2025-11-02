"""Verbose logging endpoints for real-time log streaming."""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.db.models.user import User
from app.services.verbose_logger import verbose_logger
import asyncio
import json

router = APIRouter()


@router.get("/verbose/stream")
async def stream_logs(
    token: str = None,
    current_user: User = Depends(get_current_user)
):
    """Stream verbose logs via Server-Sent Events."""
    
    async def event_generator():
        queue = await verbose_logger.subscribe()
        
        try:
            # Send initial connection message
            yield f"data: {json.dumps({'message': 'Verbose logger connected', 'level': 'info', 'emoji': '✅'})}\n\n"
            
            # Send existing log history first
            history = verbose_logger.get_history()
            for log_entry in history:
                yield f"data: {json.dumps(log_entry)}\n\n"
            
            # Then stream new logs with periodic heartbeats
            heartbeat_interval = 25.0  # Send heartbeat every 25 seconds
            last_heartbeat = asyncio.get_event_loop().time()
            
            while True:
                try:
                    # Wait for log entry with timeout
                    log_entry = await asyncio.wait_for(queue.get(), timeout=heartbeat_interval)
                    yield f"data: {json.dumps(log_entry)}\n\n"
                    last_heartbeat = asyncio.get_event_loop().time()
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    current_time = asyncio.get_event_loop().time()
                    if current_time - last_heartbeat >= heartbeat_interval:
                        yield f": heartbeat\n\n"
                        last_heartbeat = current_time
        except Exception as e:
            print(f"Error in event generator: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await verbose_logger.unsubscribe(queue)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/verbose/history")
async def get_log_history(
    current_user: User = Depends(get_current_user)
):
    """Get log history."""
    return {"logs": verbose_logger.get_history()}


@router.delete("/verbose/clear")
async def clear_logs(
    current_user: User = Depends(get_current_user)
):
    """Clear log history."""
    verbose_logger.clear()
    return {"message": "Logs cleared"}

