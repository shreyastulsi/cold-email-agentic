# API URL Configuration Fix

## Problem
After deployment, the frontend could not fetch data from the backend (dashboard, resume section, etc.) because the API base URL was defaulting to `http://localhost:8000` instead of the production backend URL.

## Solution Implemented

### 1. Smart API URL Detection
Updated `frontend/src/utils/api.js` to automatically detect the backend URL in production:

- **First**: Checks for `VITE_API_BASE_URL` environment variable (explicit configuration)
- **Second**: In production (Cloud Run), tries to infer backend URL from frontend URL
  - If frontend is at `frontend-xxxxx-uc.a.run.app`, tries `backend-xxxxx-uc.a.run.app`
  - Works if services follow naming convention: `frontend-*` → `backend-*`
- **Third**: Falls back to `localhost:8000` for local development

### 2. Centralized API Configuration
- All API URL references now use the centralized `API_BASE_URL` from `utils/api.js`
- Updated files:
  - `frontend/src/utils/api.js` - Main API utility with smart detection
  - `frontend/src/pages/Dashboard.jsx` - Uses `apiRequest()` helper
  - `frontend/src/pages/ResumeEditor.jsx` - Uses centralized `API_BASE_URL`
  - `frontend/src/components/ResumeUpload.jsx` - Uses centralized `API_BASE_URL`
  - `frontend/src/pages/Search.jsx` - Uses centralized `API_BASE_URL`
  - `frontend/src/components/VerboseLogger.jsx` - Uses centralized `API_BASE_URL`

### 3. Enhanced Error Messages
- Better error logging shows the API URL being used
- Network errors provide helpful messages about configuration

## How to Verify It's Working

### Check Browser Console
1. Open your deployed frontend
2. Open browser DevTools (F12) → Console tab
3. Look for: `[API] Using API base URL: https://your-backend-url`
4. If you see `localhost:8000`, the environment variable is not set

### Check Network Tab
1. Open DevTools → Network tab
2. Navigate to Dashboard or Resume section
3. Look for failed requests
4. Check the request URL - it should point to your backend, not localhost

## Proper Fix: Set Environment Variable

While the smart detection helps, **you should still set `VITE_API_BASE_URL` during build** for reliability.

### For GitHub Actions Deployment

Your frontend Dockerfile expects these build arguments:
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Check your GitHub Actions workflow** (`.github/workflows/deploy-frontend.yml`) and ensure it passes these as build arguments:

```yaml
- name: Build and push Docker image
  run: |
    docker build \
      --build-arg VITE_API_BASE_URL=${{ secrets.FRONTEND_PUBLIC_API_BASE_URL }} \
      --build-arg VITE_SUPABASE_URL=${{ secrets.VITE_SUPABASE_URL }} \
      --build-arg VITE_SUPABASE_ANON_KEY=${{ secrets.VITE_SUPABASE_ANON_KEY }} \
      -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/frontend:latest \
      ./frontend
```

**Note**: The deployment guide mentions `FRONTEND_PUBLIC_API_BASE_URL` as the secret name, but the Dockerfile expects `VITE_API_BASE_URL` as the build arg. Make sure your workflow maps it correctly.

### Quick Fix Steps

1. **Get your backend URL**:
   - Go to GCP Console → Cloud Run
   - Find your `backend` service
   - Copy the URL (e.g., `https://backend-xxxxx-uc.a.run.app`)

2. **Update GitHub Secret**:
   - GitHub → Settings → Secrets and variables → Actions
   - Edit `FRONTEND_PUBLIC_API_BASE_URL` (or create it if missing)
   - Set it to your backend URL: `https://backend-xxxxx-uc.a.run.app`

3. **Redeploy Frontend**:
   - Go to GitHub Actions
   - Run the "Deploy Frontend" workflow manually
   - Or push a change to trigger automatic deployment

4. **Verify**:
   - After deployment, check browser console for the API URL
   - Test dashboard and resume sections

## Testing Locally

The fix works in local development too. Just ensure `frontend/.env` has:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### Still seeing `localhost:8000` in production?
- Check that `VITE_API_BASE_URL` is set in GitHub Secrets
- Verify the workflow passes it as a build argument
- Check browser console for the detected URL
- The smart detection should work if services are named `frontend-*` and `backend-*`

### Getting CORS errors?
- Ensure `CORS_ORIGINS` in backend includes your frontend URL
- Check backend logs for CORS configuration

### Network errors?
- Verify backend is deployed and accessible
- Check backend health: `https://your-backend-url/healthz`
- Verify authentication tokens are being sent correctly

## Files Changed

- `frontend/src/utils/api.js` - Smart URL detection and centralized config
- `frontend/src/pages/Dashboard.jsx` - Uses centralized API
- `frontend/src/pages/ResumeEditor.jsx` - Uses centralized API
- `frontend/src/components/ResumeUpload.jsx` - Uses centralized API
- `frontend/src/pages/Search.jsx` - Uses centralized API
- `frontend/src/components/VerboseLogger.jsx` - Uses centralized API

