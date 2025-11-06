# LinkedIn OAuth Testing Guide

## Prerequisites

1. ✅ LinkedIn OAuth credentials added to `.env`
2. ✅ Backend server running
3. ✅ Frontend server running
4. ✅ Database migration run (for linkedin_accounts table)

## Step 1: Configure LinkedIn App Redirect URI

1. Go to: https://www.linkedin.com/developers/apps
2. Click on your app (Client ID: `86q1n6jt1j42o3`)
3. Go to the **"Auth"** tab
4. Under **"Redirect URLs"**, add:
   ```
   http://localhost:8000/api/v1/linkedin-accounts/oauth/callback
   ```
5. Click **"Update"**

## Step 2: Start Backend Server

```bash
cd backend
source venv/bin/activate  # If using virtual environment
uvicorn app.main:app --reload --port 8000
```

**Verify backend is running:**
- Check: http://localhost:8000/healthz
- Should return: `{"ok": true}`

## Step 3: Start Frontend Server

```bash
cd frontend
npm run dev
```

**Verify frontend is running:**
- Check: http://localhost:5173
- Should show your app

## Step 4: Test LinkedIn Account Connection

### 4.1 Navigate to LinkedIn Accounts Page

1. Go to: http://localhost:5173/dashboard/settings/linkedin-accounts
   - Or: Settings → Email Accounts tab → Click "Manage LinkedIn Accounts"

### 4.2 Connect Your LinkedIn Account

1. Click **"+ Connect LinkedIn Account"** button
2. A popup window should open with LinkedIn OAuth
3. **Allow popups** if blocked by browser
4. Login to LinkedIn and authorize the app
5. You should be redirected back and the popup should close
6. Your LinkedIn account should appear in the list

### 4.3 Verify Connection

**Check Backend Logs:**
You should see:
```
✅ Using LinkedIn OAuth for user {user_id}
```

**Check Database:**
```sql
SELECT * FROM linkedin_accounts;
```
Should show your connected account with:
- `profile_id`
- `access_token`
- `refresh_token`
- `token_expires_at`
- `is_active = true`

## Step 5: Test LinkedIn Invitation Sending

### 5.1 Before Connecting (Test Unipile Fallback)

1. **Disconnect** your LinkedIn account (or test before connecting)
2. Go to Search page: http://localhost:5173/dashboard/search
3. Search for a company (e.g., "Amazon")
4. Select jobs and map to recruiters
5. Generate messages
6. Try to send a LinkedIn invitation

**Expected Behavior:**
- Should use **Unipile** (fallback)
- Check backend logs: `📨 Using Unipile for LinkedIn invitation`
- Should work normally

### 5.2 After Connecting (Test LinkedIn OAuth)

1. **Connect** your LinkedIn account (Step 4)
2. Go to Search page: http://localhost:5173/dashboard/search
3. Search for a company (e.g., "Amazon")
4. Select jobs and map to recruiters
5. Generate messages
6. Try to send a LinkedIn invitation

**Expected Behavior:**
- Should use **LinkedIn OAuth** (your account)
- Check backend logs: `✅ Using LinkedIn OAuth for user {user_id}`
- Should send from your LinkedIn account

**Check Backend Logs:**
```bash
# Watch backend logs in real-time
tail -f backend/logs/*.log

# Or check console output
# You should see:
# "✅ Using LinkedIn OAuth for user {user_id}"
# OR
# "📨 Using Unipile for LinkedIn invitation"
```

## Step 6: Test API Endpoints Directly

### 6.1 Get LinkedIn Accounts List

```bash
# Get your auth token first (from browser DevTools → Application → Cookies)
curl -X GET "http://localhost:8000/api/v1/linkedin-accounts" \
  -H "Cookie: your-auth-cookie"
```

### 6.2 Get OAuth Auth URL

```bash
curl -X GET "http://localhost:8000/api/v1/linkedin-accounts/oauth/auth-url" \
  -H "Cookie: your-auth-cookie"
```

Should return:
```json
{
  "auth_url": "https://www.linkedin.com/oauth/v2/authorization?...",
  "state": "..."
}
```

### 6.3 Test LinkedIn Invitation Endpoint

```bash
curl -X POST "http://localhost:8000/api/v1/outreach/linkedin/send" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "linkedin_url": "https://www.linkedin.com/in/some-profile",
    "message": "Test invitation message"
  }'
```

**Response should include:**
```json
{
  "success": true,
  "result": {...},
  "method": "linkedin_oauth"  // or "unipile"
}
```

## Step 7: Verify Database Updates

### Check LinkedIn Accounts Table

```bash
# Connect to your database and run:
psql your_database_url

# Then:
SELECT id, owner_id, profile_id, display_name, is_active, is_default, created_at 
FROM linkedin_accounts;
```

### Check Token Refresh

1. Wait for token to expire (or manually set `token_expires_at` to past date)
2. Try sending an invitation
3. Check logs - should see token refresh attempt
4. Token should be refreshed automatically

## Step 8: Test Error Handling

### 8.1 Test with Invalid Credentials

1. Temporarily change `LINKEDIN_CLIENT_SECRET` in `.env` to wrong value
2. Try to connect LinkedIn account
3. Should show error message

### 8.2 Test with Expired Token

1. Manually set `token_expires_at` to past date in database
2. Try sending invitation
3. Should attempt to refresh token
4. If refresh fails, should fallback to Unipile

### 8.3 Test OAuth Flow Cancellation

1. Click "Connect LinkedIn Account"
2. Close the popup without authorizing
3. Should handle gracefully (no crash)

## Common Issues & Solutions

### Issue: "LinkedIn OAuth not configured"
**Solution:** Make sure `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are in `.env` and backend is restarted

### Issue: "Redirect URI mismatch"
**Solution:** Add `http://localhost:8000/api/v1/linkedin-accounts/oauth/callback` to LinkedIn app redirect URIs

### Issue: "Popup blocked"
**Solution:** Allow popups for localhost in browser settings

### Issue: "Token expired" errors
**Solution:** Check if refresh token is working. LinkedIn tokens typically last 60 days.

### Issue: Still using Unipile after connecting
**Solution:** 
- Check if account is active: `SELECT is_active FROM linkedin_accounts WHERE owner_id = 'your_user_id'`
- Check backend logs for error messages
- Verify access_token is present

## Verification Checklist

- [ ] LinkedIn app redirect URI configured
- [ ] Backend server running
- [ ] Frontend server running
- [ ] LinkedIn account connected successfully
- [ ] Account appears in database
- [ ] Sending invitation uses LinkedIn OAuth (check logs)
- [ ] Fallback to Unipile works when no LinkedIn account
- [ ] Token refresh works when token expires
- [ ] Error handling works correctly

## Debugging Tips

1. **Check Backend Logs:**
   ```bash
   # Watch logs in real-time
   tail -f backend/logs/*.log
   ```

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Check Console for errors
   - Check Network tab for API calls

3. **Check Database:**
   ```sql
   -- Check if account exists
   SELECT * FROM linkedin_accounts WHERE owner_id = 'your_user_id';
   
   -- Check token expiration
   SELECT profile_id, token_expires_at, is_active 
   FROM linkedin_accounts 
   WHERE owner_id = 'your_user_id';
   ```

4. **Test API Endpoints:**
   - Use Postman or curl to test endpoints directly
   - Check response codes and error messages

## Expected Flow

```
User clicks "Send LinkedIn Invitation"
    ↓
Backend checks: Does user have LinkedIn account?
    ↓
YES → Use LinkedIn OAuth API
    ↓
Check: Is token expired?
    ↓
YES → Refresh token
    ↓
Send invitation via LinkedIn API
    ↓
Update last_used_at
    ↓
Return success

NO → Use Unipile API (fallback)
    ↓
Send invitation via Unipile
    ↓
Return success
```

## Next Steps After Testing

1. Test in production environment
2. Update redirect URI for production URL
3. Monitor rate limits (LinkedIn: 100 connections/month per account)
4. Set up monitoring/alerting for OAuth failures
5. Document any LinkedIn API endpoint changes needed

