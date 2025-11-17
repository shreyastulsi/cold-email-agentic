# Fix Deployment API Connection Issue

## Problem
The frontend can navigate through pages but cannot fetch data from the backend. Error message:
```
Failed to load drafts: Network error: Cannot connect to backend at https://backend-1055669887302.europe-west2.run.app
```

## Root Causes

1. **Missing `VITE_API_BASE_URL` build argument**: Vite environment variables must be set at BUILD time, not runtime. The Docker image was built without this variable.
2. **CORS configuration**: The backend may not have the frontend URL in its CORS allowed origins.
3. **URL inference fallback**: The frontend tries to infer the backend URL, but it may not match your actual Cloud Run service names.

## Solution

### Step 1: Get Your Service URLs

1. Go to [Google Cloud Console](https://console.cloud.google.com/run)
2. Find your services and note their URLs:
   - **Frontend URL**: `https://frontend-XXXXX.europe-west2.run.app` (or similar)
   - **Backend URL**: `https://backend-1055669887302.europe-west2.run.app` (from your error)

### Step 2: Update Backend CORS Configuration

The backend needs to allow requests from your frontend URL.

**Option A: Using Environment Variable (Recommended)**

1. Go to **Cloud Run** → Your backend service → **Edit & Deploy New Revision**
2. Under **Variables & Secrets**, add or update:
   - **CORS_ORIGINS**: `https://your-frontend-url.run.app,http://localhost:5173`
   - (Replace `your-frontend-url.run.app` with your actual frontend URL)
3. Click **Deploy**

**Option B: Using gcloud CLI**

```bash
gcloud run services update backend \
  --region=europe-west2 \
  --update-env-vars="CORS_ORIGINS=https://your-frontend-url.run.app,http://localhost:5173" \
  --project=YOUR_PROJECT_ID
```

### Step 3: Rebuild Frontend with VITE_API_BASE_URL

You need to rebuild the frontend Docker image with the `VITE_API_BASE_URL` build argument.

**Option A: Using gcloud CLI (Recommended)**

```bash
# Set variables
export PROJECT_ID="your-project-id"
export REGION="europe-west2"
export BACKEND_URL="https://backend-1055669887302.europe-west2.run.app"
export FRONTEND_SERVICE="frontend"  # Your frontend service name

# Build and push the image
cd frontend
gcloud builds submit \
  --tag gcr.io/${PROJECT_ID}/${FRONTEND_SERVICE} \
  --project=${PROJECT_ID} \
  --substitutions=_VITE_API_BASE_URL=${BACKEND_URL}

# Deploy to Cloud Run
gcloud run deploy ${FRONTEND_SERVICE} \
  --image gcr.io/${PROJECT_ID}/${FRONTEND_SERVICE} \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --project=${PROJECT_ID}
```

**Option B: Using Docker Build with Build Args**

If you're building locally and pushing:

```bash
cd frontend

# Build with the build argument
docker build \
  --build-arg VITE_API_BASE_URL=https://backend-1055669887302.europe-west2.run.app \
  --build-arg VITE_SUPABASE_URL=your-supabase-url \
  --build-arg VITE_SUPABASE_ANON_KEY=your-supabase-anon-key \
  -t gcr.io/YOUR_PROJECT_ID/frontend:latest .

# Push to Google Container Registry
docker push gcr.io/YOUR_PROJECT_ID/frontend:latest

# Deploy to Cloud Run
gcloud run deploy frontend \
  --image gcr.io/YOUR_PROJECT_ID/frontend:latest \
  --region=europe-west2 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080
```

**Option C: Update Dockerfile to Accept Build Args (If Not Already)**

The Dockerfile should already have this, but verify `frontend/Dockerfile` includes:

```dockerfile
# Build arguments for environment variables
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
```

### Step 4: Verify the Fix

1. **Check browser console**: Open your deployed frontend and check the browser console. You should see:
   ```
   [API] Using VITE_API_BASE_URL from environment: https://backend-1055669887302.europe-west2.run.app
   ```

2. **Test API connection**: Try accessing a page that fetches data (like Drafts). It should work now.

3. **Check backend logs**: Verify requests are coming through:
   ```bash
   gcloud run services logs read backend --region=europe-west2 --limit=50
   ```

## Alternative: Quick Fix Using URL Inference

If you can't rebuild immediately, the improved URL inference logic should help. The frontend will try to automatically detect the backend URL from the frontend URL. However, this is less reliable than setting `VITE_API_BASE_URL` explicitly.

To use this:
1. Make sure your frontend and backend service names follow a pattern like:
   - Frontend: `frontend-1055669887302.europe-west2.run.app`
   - Backend: `backend-1055669887302.europe-west2.run.app`
2. The frontend will automatically infer: `backend-1055669887302.europe-west2.run.app`

## Prevention: For Future Deployments

### Using GitHub Actions

If you're using GitHub Actions, make sure your workflow passes build args:

```yaml
- name: Build and push frontend
  run: |
    gcloud builds submit \
      --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/frontend \
      --substitutions=_VITE_API_BASE_URL=${{ secrets.BACKEND_URL }} \
      --project=${{ secrets.GCP_PROJECT_ID }}
```

### Using Cloud Build

Create a `cloudbuild.yaml` in your frontend directory:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_API_BASE_URL=${_VITE_API_BASE_URL}'
      - '--build-arg'
      - 'VITE_SUPABASE_URL=${_VITE_SUPABASE_URL}'
      - '--build-arg'
      - 'VITE_SUPABASE_ANON_KEY=${_VITE_SUPABASE_ANON_KEY}'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/frontend:${SHORT_SHA}'
      - '.'
    dir: 'frontend'
substitutions:
  _VITE_API_BASE_URL: 'https://backend-1055669887302.europe-west2.run.app'
```

## Troubleshooting

### Still seeing connection errors?

1. **Check CORS**: Make sure the backend has the frontend URL in `CORS_ORIGINS`
2. **Verify backend is running**: `curl https://backend-1055669887302.europe-west2.run.app/healthz`
3. **Check browser console**: Look for the actual API URL being used
4. **Check network tab**: See if requests are being blocked by CORS

### CORS errors in browser console?

If you see CORS errors, the backend `CORS_ORIGINS` doesn't include your frontend URL. Update it as described in Step 2.

### 404 errors?

The backend URL might be incorrect. Double-check the backend service URL in Cloud Run console.

## Summary

The fix requires:
1. ✅ Setting `VITE_API_BASE_URL` as a build argument when building the frontend Docker image
2. ✅ Ensuring backend `CORS_ORIGINS` includes the frontend URL
3. ✅ Rebuilding and redeploying the frontend service

The improved URL inference logic will help as a fallback, but explicitly setting `VITE_API_BASE_URL` is the proper solution.

