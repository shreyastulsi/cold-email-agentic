# Setting Up Unipile Webhook for Local Development

## The Problem

When running your backend on `localhost:8000`, Unipile's servers cannot reach your webhook endpoint (`http://localhost:8000/api/v1/linkedin-accounts/unipile/webhook`) because `localhost` is only accessible on your local machine.

This means:
- ✅ The LinkedIn OAuth flow completes successfully
- ✅ Unipile redirects you back to the success page
- ❌ But the webhook never fires, so the account isn't saved to your database

## Solution: Use ngrok (Recommended for Local Development)

### Step 1: Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start ngrok

```bash
# Expose your backend port
ngrok http 8000
```

This will give you a public URL like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8000
```

### Step 3: Update Your Backend URL

Update `backend/.env`:

```env
# Use the ngrok URL instead of localhost
BACKEND_URL=https://abc123.ngrok.io
```

**Important:** Get the HTTPS URL (not HTTP) from ngrok.

### Step 4: Restart Your Backend

Restart your backend so it picks up the new `BACKEND_URL`:

```bash
# If using Docker
cd infra && docker-compose restart backend

# If running locally, restart uvicorn
```

### Step 5: Try Connecting Again

Now when you connect LinkedIn:
1. The webhook URL will be: `https://abc123.ngrok.io/api/v1/linkedin-accounts/unipile/webhook`
2. Unipile can reach this URL
3. The webhook will fire and create the account in your database

## Alternative: Check Backend Logs Manually

If you don't want to use ngrok, you can:

1. Check your backend logs for webhook attempts
2. Manually verify if Unipile tried to call the webhook
3. If needed, manually create the account using the Unipile account ID from Unipile's dashboard

## Production Setup

In production, make sure:
- Your `BACKEND_URL` points to your actual production domain
- The webhook endpoint is publicly accessible
- HTTPS is enabled (required for production)

## Testing the Webhook

You can test if your webhook endpoint is accessible:

```bash
# Test locally
curl -X POST http://localhost:8000/api/v1/linkedin-accounts/unipile/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CREATION_SUCCESS",
    "account_id": "test-account-id",
    "name": "test-user-id"
  }'
```

If this works locally but Unipile can't reach it, you need ngrok or a public URL.

