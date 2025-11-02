# Viewing Backend Logs

## Current Status
Your backend is running in a terminal. Logs are output to that terminal.

## Two Backend Instances Running
- Port 8000: Process 35860
- Port 8001: Process 11855 (running in terminal session s038)

## To See Logs

### Option 1: Find Your Terminal
Look for the terminal window where you ran:
```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

That terminal will show all the log messages including:
- OAuth token exchange requests
- Redirect URIs being used
- Error responses from Google

### Option 2: View File Logs (After Restart)
I've configured the backend to also write logs to a file. 

**After restarting the backend**, you can view logs with:

```bash
cd backend
./view_logs.sh        # View last 50 lines
tail -f logs/backend.log  # Follow logs in real-time
```

### Option 3: Restart Backend Now
To start getting file logs immediately:

1. Stop the current backend (Ctrl+C in its terminal, or kill the process)
2. Restart it - logs will now be saved to `backend/logs/backend.log`
3. Then you can view logs with: `cd backend && tail -f logs/backend.log`

## What Logs Show
When you try OAuth, you'll see:
- `INFO: OAuth token exchange - redirect_uri: http://localhost:8000/api/v1/email-accounts/oauth/gmail/callback`
- `INFO: Token exchange request - client_id: 767331190371-b9n7lr1...`
- `INFO: Token exchange response status: 401` (or 200 if successful)
- `ERROR: Token exchange error response: {...}` (if there's an error)

## Quick Command
```bash
cd backend && tail -f logs/backend.log
```

