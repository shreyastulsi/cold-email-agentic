# Backend Deployment Issue - FastAPI Not Running

## Problem
The backend is deployed to Cloud Run but showing the default "Congratulations" page instead of the FastAPI app. This means the container is running but the FastAPI application isn't starting.

## Root Cause
The backend Dockerfile hardcodes port 8000, but Cloud Run requires the app to listen on the `PORT` environment variable.

## Fix Applied
Updated `backend/Dockerfile` to use the `PORT` environment variable that Cloud Run provides.

## Next Steps

### 1. Check Backend Logs in GCP
1. Go to **GCP Console** → **Cloud Run**
2. Click on your `backend` service
3. Go to **Logs** tab
4. Look for errors during startup

Common errors you might see:
- Database connection failures
- Missing environment variables
- Import errors
- Port binding issues

### 2. Verify Environment Variables
Make sure these GitHub secrets are set correctly:
- `BACKEND_DATABASE_URL` - Supabase connection string
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `CORS_ORIGINS` - Must include your frontend URL

### 3. Redeploy Backend
After fixing the Dockerfile, you need to redeploy:

**Option A: Via GitHub Actions**
1. Commit the Dockerfile change
2. Push to main branch
3. The workflow should auto-deploy

**Option B: Manual Deploy**
```bash
# Build and deploy manually
gcloud run deploy backend \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated
```

### 4. Test Backend After Redeploy
```bash
# Test health endpoint
curl https://backend-1055669887302.europe-west2.run.app/healthz
# Should return: {"ok":true}

# Test API docs
curl https://backend-1055669887302.europe-west2.run.app/docs
# Should return HTML for Swagger UI
```

## Common Issues

### Issue 1: Database Connection
If you see database connection errors:
- Verify `BACKEND_DATABASE_URL` is correct
- Check Supabase allows connections from Cloud Run
- Ensure `sslmode=require` in connection string

### Issue 2: Missing Environment Variables
If the app crashes on startup:
- Check all required secrets are set in GitHub
- Verify they're being passed to Cloud Run in the deployment workflow

### Issue 3: CORS Errors
If frontend can't connect:
- Verify `CORS_ORIGINS` includes your frontend URL
- Format: `https://frontend-xxxxx-uc.a.run.app`
- Redeploy backend after updating CORS

## Verification Checklist

After redeploying:
- [ ] Backend health check works: `/healthz` returns `{"ok":true}`
- [ ] API docs accessible: `/docs` shows Swagger UI
- [ ] Frontend can load drafts (no network errors)
- [ ] No errors in Cloud Run logs
- [ ] CORS configured correctly

