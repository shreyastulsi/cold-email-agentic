# Cloud Run Deployment Guide

## ✅ Files Created

1. **`frontend/Dockerfile`** - Updated for production build with nginx
2. **`.github/workflows/deploy-backend.yml`** - Backend deployment workflow
3. **`.github/workflows/deploy-frontend.yml`** - Frontend deployment workflow

## 📋 Pre-Deployment Checklist

### Required GitHub Secrets (Already Set):
- ✅ `GCP_PROJECT_ID`
- ✅ `GCP_REGION`
- ✅ `GCP_ARTIFACT_REPO_BACKEND`
- ✅ `GCP_ARTIFACT_REPO_FRONTEND`
- ✅ `GCP_WORKLOAD_IDENTITY_PROVIDER`
- ✅ `GCP_SERVICE_ACCOUNT`
- ✅ `BACKEND_DATABASE_URL` (Supabase Postgres)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `SUPABASE_JWT_SECRET`
- ✅ `FRONTEND_PUBLIC_API_BASE_URL` (set after first backend deploy)

### Optional GitHub Secrets (Add if needed):
- `CORS_ORIGINS` - Frontend URL for CORS (e.g., `https://frontend-xxxxx-uc.a.run.app`)
- `OPENAI_API_KEY` - For resume message generation
- `APOLLO_API_KEY` - For email extraction
- `UNIPILE_API_KEY` - For LinkedIn operations
- `UNIPILE_ACCOUNT_ID` - Unipile account ID
- `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL` - For email sending
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For Gmail OAuth
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` - For Outlook OAuth

## 🚀 Deployment Steps

### Step 1: First Backend Deployment

1. **Commit and push the workflow files:**
   ```bash
   git add frontend/Dockerfile .github/workflows/
   git commit -m "Add production Dockerfile and CI/CD workflows"
   git push origin main
   ```

2. **Trigger backend deployment:**
   - Go to GitHub → Your Repo → **Actions** tab
   - Click **"Deploy Backend (Cloud Run, Supabase DB)"**
   - Click **"Run workflow"** → Select `main` branch → **Run workflow**
   - Wait 5-10 minutes for completion

3. **Get backend URL:**
   - After deployment completes, go to **GCP Console** → **Cloud Run**
   - Find the `backend` service
   - Copy the URL (e.g., `https://backend-xxxxx-uc.a.run.app`)

### Step 2: Update Frontend Secret

1. **Update `FRONTEND_PUBLIC_API_BASE_URL`:**
   - GitHub → **Settings** → **Secrets and variables** → **Actions**
   - Edit `FRONTEND_PUBLIC_API_BASE_URL`
   - Set it to your backend URL (e.g., `https://backend-xxxxx-uc.a.run.app`)

2. **Optional: Add CORS_ORIGINS:**
   - Add new secret: `CORS_ORIGINS`
   - Set it to your frontend URL (you'll get this after frontend deploy)
   - Or set it now to: `https://frontend-xxxxx-uc.a.run.app` (update after frontend deploy)

### Step 3: First Frontend Deployment

1. **Trigger frontend deployment:**
   - GitHub → **Actions** tab
   - Click **"Deploy Frontend (Cloud Run)"**
   - Click **"Run workflow"** → Select `main` branch → **Run workflow**
   - Wait 5-10 minutes for completion

2. **Get frontend URL:**
   - GCP Console → **Cloud Run**
   - Find the `frontend` service
   - Copy the URL (e.g., `https://frontend-xxxxx-uc.a.run.app`)

### Step 4: Update Supabase & CORS

1. **Update Supabase Redirect URLs:**
   - Supabase Dashboard → **Authentication** → **URL Configuration**
   - Add to **Redirect URLs**:
     - `https://frontend-xxxxx-uc.a.run.app`
     - `https://frontend-xxxxx-uc.a.run.app/**`

2. **Update CORS_ORIGINS (if not done):**
   - GitHub → **Settings** → **Secrets** → **Actions**
   - Edit `CORS_ORIGINS` → Set to your frontend URL
   - Re-run backend deployment to apply CORS changes

## 🔄 Automatic Deployments

After the first deployment, **automatic deployments** will trigger on:
- **Backend**: Push to `main` with changes in `backend/` directory
- **Frontend**: Push to `main` with changes in `frontend/` directory

You can also manually trigger deployments via **Actions** → **Run workflow**

## 📝 What Each Workflow Does

### Backend Workflow:
1. Authenticates to GCP using Workload Identity Federation
2. Builds Docker image from `backend/Dockerfile`
3. Pushes image to Artifact Registry
4. Runs Alembic migrations (Cloud Run Job)
5. Deploys to Cloud Run with:
   - 2GB RAM, 2 CPU, 300s timeout
   - Database and JWT secrets from Secret Manager
   - Supabase URL and keys as environment variables

### Frontend Workflow:
1. Authenticates to GCP using Workload Identity Federation
2. Builds Docker image with Vite environment variables injected
3. Pushes image to Artifact Registry
4. Deploys to Cloud Run with:
   - 512MB RAM, 1 CPU
   - Serves static files via nginx on port 8080

## 🐛 Troubleshooting

### Backend deployment fails:
- Check GitHub secrets are all set correctly
- Verify Artifact Registry repos exist
- Check service account has required permissions
- Review workflow logs in GitHub Actions

### Frontend shows API errors:
- Verify `FRONTEND_PUBLIC_API_BASE_URL` is set correctly
- Check backend is deployed and accessible
- Verify CORS_ORIGINS includes frontend URL

### Database connection errors:
- Verify `BACKEND_DATABASE_URL` is correct Supabase connection string
- Check Supabase allows connections from Cloud Run IPs
- Ensure `sslmode=require` in connection string

## 📊 Monitoring

- **Cloud Run Console**: View logs, metrics, and service status
- **GitHub Actions**: View deployment history and logs
- **Supabase Dashboard**: Monitor database connections and queries

## 🎉 Next Steps

After successful deployment:
1. Test the deployed frontend and backend
2. Set up custom domains (optional)
3. Configure monitoring and alerts
4. Set up staging environment (optional)

