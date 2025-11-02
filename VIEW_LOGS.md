# How to View Backend Logs

## Quick Answer

### Option 1: Check Your Terminal (Current Method)
1. **Find the terminal window** where you started the backend
   - Look for the window where you ran: `uvicorn app.main:app --reload`
   - Logs appear in real-time in that terminal

2. **Look for these messages** when testing OAuth:
   ```
   INFO: OAuth token exchange - redirect_uri: http://localhost:8000/...
   INFO: Token exchange response status: 401
   ERROR: Token exchange error response: {...}
   ```

### Option 2: View File Logs (After Restart)
I've configured file logging. After restarting the backend:

1. **View last 50 lines:**
   ```bash
   cd backend
   tail -50 logs/backend.log
   ```

2. **Follow logs in real-time:**
   ```bash
   cd backend
   tail -f logs/backend.log
   ```

3. **Or use the helper script:**
   ```bash
   cd backend
   ./view_logs.sh
   ```

## How to Enable File Logging

The backend needs to be restarted to start writing logs to a file:

1. **Stop the backend:**
   - Find the terminal and press `Ctrl+C`
   - Or kill the process: `kill 35860`

2. **Restart the backend:**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **View logs in another terminal:**
   ```bash
   cd backend
   tail -f logs/backend.log
   ```

## What You'll See

When testing OAuth, logs will show:
- ✅ Redirect URI being used
- ✅ Client ID (first 20 characters)
- ✅ Authorization code length
- ✅ Response status from Google (401 = error, 200 = success)
- ✅ Full error details if something fails

## Quick Commands

```bash
# View recent logs (if file exists)
cd backend && tail -50 logs/backend.log

# Follow logs in real-time
cd backend && tail -f logs/backend.log

# Check if backend is running
ps aux | grep uvicorn
```

