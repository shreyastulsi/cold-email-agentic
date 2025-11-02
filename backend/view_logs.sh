#!/bin/bash
# View backend logs

LOG_FILE="logs/backend.log"

if [ -f "$LOG_FILE" ]; then
    echo "📋 Viewing backend logs from file:"
    echo "=================================="
    tail -50 "$LOG_FILE"
    echo ""
    echo "To follow logs in real-time, run:"
    echo "  tail -f $LOG_FILE"
else
    echo "⚠️  Log file not found: $LOG_FILE"
    echo ""
    echo "The backend is currently logging to the terminal where it was started."
    echo ""
    echo "To see logs:"
    echo "1. Find the terminal where you ran: uvicorn app.main:app --reload"
    echo "2. Or restart the backend - logs will now be saved to: $LOG_FILE"
    echo ""
    echo "Process information:"
    ps aux | grep "uvicorn app.main:app" | grep -v grep | head -2
fi

