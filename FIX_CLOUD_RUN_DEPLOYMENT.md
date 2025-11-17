# Fix Cloud Run Deployment - Secret Error

## Problem
The `alembic-migrate` job exists with Google Cloud Secret Manager references, but the secret doesn't exist.

## Solution 1: Delete the Job Manually (Recommended)

Run this command to delete the existing job:

```bash
gcloud run jobs delete alembic-migrate \
  --region YOUR_REGION \
  --project YOUR_PROJECT_ID \
  --quiet
```

Then re-run your GitHub Actions deployment. The workflow will recreate the job with the correct configuration.

## Solution 2: Create the Secret in Google Cloud Secret Manager

If you want to use Google Cloud Secret Manager (more secure for production):

### Step 1: Create the secret
```bash
# Get your DATABASE_URL value
echo -n "YOUR_DATABASE_URL_HERE" | gcloud secrets create BACKEND_DATABASE_URL \
  --data-file=- \
  --replication-policy="automatic" \
  --project YOUR_PROJECT_ID
```

### Step 2: Grant access to your service account
```bash
gcloud secrets add-iam-policy-binding BACKEND_DATABASE_URL \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project YOUR_PROJECT_ID
```

### Step 3: Update your workflow to use secrets

Replace line 69 in `.github/workflows/deploy-backend.yml`:

**Current:**
```yaml
--set-env-vars "DATABASE_URL=${{ secrets.BACKEND_DATABASE_URL }},PYTHONDONTWRITEBYTECODE=1" \
```

**Change to:**
```yaml
--set-secrets "DATABASE_URL=BACKEND_DATABASE_URL:latest" \
--set-env-vars "PYTHONDONTWRITEBYTECODE=1" \
```

And update line 78 for the main service:

**Current:**
```yaml
ENV_VARS="PYTHONDONTWRITEBYTECODE=1,DATABASE_URL=${{ secrets.BACKEND_DATABASE_URL }},..."
```

**Change to:**
```bash
gcloud run deploy $SERVICE_NAME \
  ... \
  --set-secrets "DATABASE_URL=BACKEND_DATABASE_URL:latest,SUPABASE_JWT_SECRET=SUPABASE_JWT_SECRET:latest" \
  --set-env-vars "PYTHONDONTWRITEBYTECODE=1,SUPABASE_URL=${{ secrets.SUPABASE_URL }},SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}"
```

## Why This Happens

- **GitHub Secrets** = Used by GitHub Actions during the workflow
- **Google Cloud Secret Manager** = Used by Cloud Run at runtime

Your error occurs because the job is configured to use Google Cloud Secret Manager, but the secret doesn't exist there.

## Recommended Approach for Production

Use **Google Cloud Secret Manager** for:
- DATABASE_URL (contains sensitive connection strings)
- JWT secrets
- Any production credentials

Use **Environment Variables** (from GitHub Secrets) for:
- Non-sensitive configuration
- URLs that aren't secrets (like SUPABASE_URL if it's just a URL)

This way, secrets are properly managed and rotated in Google Cloud.

