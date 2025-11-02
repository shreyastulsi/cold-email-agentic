"""Verbose logger for streaming logs to frontend via SSE."""
import asyncio
import json
import threading
from datetime import datetime
from typing import Dict, List, Optional
from collections import deque

class VerboseLogger:
    """Thread-safe logger that emits logs to SSE clients."""
    
    def __init__(self, max_logs: int = 1000):
        self.logs: deque = deque(maxlen=max_logs)
        self.subscribers: List[asyncio.Queue] = []
        self.lock = threading.Lock()  # Thread-safe lock
    
    async def log(self, message: str, level: str = "info", emoji: str = ""):
        """Log a message and emit to all subscribers."""
        timestamp = datetime.utcnow().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "level": level,  # info, success, warning, error
            "message": message,
            "emoji": emoji
        }
        
        # Add to log history (thread-safe)
        with self.lock:
            self.logs.append(log_entry)
        
        # Emit to all subscribers
        dead_subscribers = []
        subscribers_copy = list(self.subscribers)  # Copy to avoid lock issues
        for queue in subscribers_copy:
            try:
                await queue.put(log_entry)
            except Exception:
                dead_subscribers.append(queue)
        
        # Clean up dead subscribers
        if dead_subscribers:
            with self.lock:
                self.subscribers = [s for s in self.subscribers if s not in dead_subscribers]
    
    async def subscribe(self) -> asyncio.Queue:
        """Subscribe to log stream."""
        queue = asyncio.Queue()
        with self.lock:
            self.subscribers.append(queue)
        return queue
    
    async def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribe from log stream."""
        with self.lock:
            if queue in self.subscribers:
                self.subscribers.remove(queue)
    
    def get_history(self) -> List[Dict]:
        """Get log history."""
        return list(self.logs)
    
    def clear(self):
        """Clear log history."""
        with self.lock:
            self.logs.clear()


# Global verbose logger instance
verbose_logger = VerboseLogger()

