# How to Check Backend Logs in Cloud Run

## The Problem
You're only seeing audit logs (service creation), not application logs. This means the container might be crashing on startup.

## How to View Actual Application Logs

### Method 1: Cloud Run Logs (Recommended)
1. Go to **GCP Console** → **Cloud Run**
2. Click on your `backend` service
3. Click the **"Logs"** tab (not "Activity")
4. Look for:
   - Container startup logs
   - Python errors
   - Import errors
   - Database connection errors
   - Environment variable issues

### Method 2: Using gcloud CLI
```bash
# View recent logs
gcloud run services logs read backend \
  --region europe-west2 \
  --limit 50

# Follow logs in real-time
gcloud run services logs tail backend \
  --region europe-west2
```

### Method 3: Cloud Logging Console
1. Go to **GCP Console** → **Logging** → **Logs Explorer**
2. Filter by:
   - Resource type: `cloud_run_revision`
   - Service name: `backend`
3. Look for logs with severity ERROR or WARNING

## What to Look For

Common errors you might see:

### 1. Database Connection Error
```
Error: could not connect to server
```
**Fix**: Check `BACKEND_DATABASE_URL` secret is correct

### 2. Missing Environment Variable
```
KeyError: 'SUPABASE_URL'
```
**Fix**: Verify all required secrets are set in GitHub

### 3. Import Error
```
ModuleNotFoundError: No module named 'app'
```
**Fix**: Check Dockerfile is copying files correctly

### 4. Port Binding Error
```
Address already in use
```
**Fix**: Should be fixed by the PORT env var change

### 5. Application Crash
```
Application startup failed
```
**Fix**: Check the specific error message

## Quick Test

After checking logs, test if the backend is responding:

```bash
# Test health endpoint
curl https://backend-1055669887302.europe-west2.run.app/healthz

# Test API docs
curl https://backend-1055669887302.europe-west2.run.app/docs
```

## Next Steps

1. **Check the Logs tab** in Cloud Run (not Activity)
2. **Share the error messages** you see
3. **Verify GitHub secrets** are all set
4. **Redeploy** after fixing any issues

The audit log you're seeing just means the service was created - we need to see the actual container logs to diagnose why the app isn't running.

