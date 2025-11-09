# ✅ Outreach History - Permanent Message Tracking

## Overview
Created a **separate `outreach_history` table** that permanently stores all sent messages. This history is **independent of drafts** - deleting drafts does NOT delete your outreach history!

---

## 🎯 Problem Solved

### Before ❌
- Dashboard "Latest Attempts" fetched from `drafts` table
- If you deleted a draft → Lost the history
- No permanent record of sent messages
- Cluttered drafts page with old sent messages

### After ✅
- Dashboard fetches from `outreach_history` table
- Delete drafts freely → History is preserved
- Permanent record of all sent messages
- Clean drafts management without losing data

---

## 🗄️ New Database Table

### `outreach_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Unique identifier |
| `user_id` | String (FK) | User who sent the message (indexed) |
| `recipient_name` | String | Recruiter name |
| `recipient_email` | String | Email address (for emails) |
| `recipient_linkedin_url` | String | LinkedIn URL (for LinkedIn) |
| `job_title` | String | Job position |
| `company_name` | String | Company name |
| `channel` | String | "email", "linkedin", or "both" |
| `email_subject` | String | Email subject (optional) |
| `email_body` | Text | Email body (optional) |
| `linkedin_message` | Text | LinkedIn message (optional) |
| `sent_at` | DateTime | When message was sent (indexed) |
| `created_at` | DateTime | Record creation time |
| `draft_id` | Integer | Link to draft (if sent from drafts) |

**Key Features:**
- ✅ Indexed on `user_id` and `sent_at` for fast queries
- ✅ Completely independent of `drafts` table
- ✅ Stores full message content for reference
- ✅ Tracks channel (email, linkedin, or both)

---

## 📊 Data Flow

### When You Send a Message:

```
User sends message
    ↓
├─ From Search/Messages Page:
│     POST /api/v1/outreach/email/send OR /outreach/linkedin/send
│     ↓
│     ✅ Send message
│     ✅ Create OutreachHistory record
│     ✅ Increment user stats
│     (No draft created)
│
└─ From Drafts Page:
      POST /api/v1/drafts/{id}/send
      ↓
      ✅ Send message
      ✅ Mark draft as sent
      ✅ Create OutreachHistory record(s)
      ✅ Increment user stats
```

### Dashboard Fetches History:

```
Dashboard loads
    ↓
GET /api/v1/user-stats
    ↓
Query outreach_history table:
  WHERE user_id = current_user.id
  ORDER BY sent_at DESC
  LIMIT 20
    ↓
Return latest 20 sent messages
    ↓
Dashboard displays in "Latest Attempts"
```

### When You Delete a Draft:

```
User deletes draft
    ↓
DELETE /api/v1/drafts/{id}
    ↓
✅ Draft removed from drafts table
❌ OutreachHistory NOT affected
    ↓
Dashboard still shows the message in "Latest Attempts"
```

---

## 🔧 Implementation Details

### Files Modified

#### 1. **New Model:** `backend/app/db/models/outreach_history.py`
- Created `OutreachHistory` model
- Permanent storage for all sent messages

#### 2. **Migration:** `backend/alembic/versions/86e4fd825eef_add_outreach_history_table.py`
- Creates `outreach_history` table
- Adds indexes on `user_id` and `sent_at`

#### 3. **Updated:** `backend/app/api/v1/outreach.py`
- `/outreach/email/send` → Creates `OutreachHistory` record
- `/outreach/linkedin/send` → Creates `OutreachHistory` record
- Removed draft creation (drafts only for draft management now)

#### 4. **Updated:** `backend/app/api/v1/drafts.py`
- `/drafts/{id}/send` → Creates `OutreachHistory` record(s)
- Creates separate records for email and linkedin if both sent
- Creates combined "both" record if both channels used
- Links back to draft via `draft_id` field

#### 5. **Updated:** `backend/app/api/v1/user_stats.py`
- `/user-stats` → Fetches from `outreach_history` instead of `drafts`
- Returns last 20 sent messages
- Persists even if drafts are deleted

#### 6. **Updated:** `backend/app/db/models/__init__.py`
- Added `OutreachHistory` to model imports

---

## 🚀 Usage

### Clean Up Old Drafts Safely

You can now delete old drafts without losing history:

1. Go to **Drafts** page
2. Delete sent drafts you no longer need
3. Go to **Dashboard**
4. ✅ Your sent messages still appear in "Latest Attempts"!

### View Outreach History

The Dashboard "Latest Attempts" table shows:
- ✅ Last 20 sent messages (from history table)
- ✅ Persists forever (unless you manually delete from DB)
- ✅ User-isolated (each user sees only their history)
- ✅ Includes all metadata (recruiter, company, title, channel)

### Message Content Storage

The `outreach_history` table stores:
- ✅ Full email subject and body
- ✅ Full LinkedIn message
- ✅ Recipient information
- ✅ Job and company details
- ✅ Timestamp of when it was sent

---

## 🎨 Dashboard Display

### Channel Display

| Database Value | Display |
|---------------|---------|
| `email` | Email |
| `linkedin` | LinkedIn |
| `both` | Email + LinkedIn |

### Latest Attempts Table

```
Time        | Recruiter    | Company | Title              | Channel          | Status
------------|--------------|---------|-------------------|------------------|--------
2:45 PM     | John Doe     | Google  | Software Engineer | Email + LinkedIn | sent
2:30 PM     | Sarah Smith  | Meta    | Senior SWE        | LinkedIn         | sent
2:15 PM     | Mike Johnson | Apple   | iOS Engineer      | Email            | sent
```

---

## 🔒 User Isolation

✅ All queries filter by `user_id`:
```python
select(OutreachHistory)
.where(OutreachHistory.user_id == current_user.id)
```

✅ Each user only sees their own history  
✅ No cross-user data leakage  
✅ Fully isolated per Supabase auth user  

---

## 📈 Migration Applied

The migration was successfully run:
```bash
./venv/bin/alembic upgrade head
```

**Status:** ✅ Table created, ready to use!

---

## ✅ Benefits

1. **Permanent History** - Never lose track of who you've contacted
2. **Clean Drafts Management** - Delete drafts without losing data
3. **Better Organization** - Separate draft management from history tracking
4. **Faster Queries** - Indexed on `sent_at` for quick dashboard loads
5. **Full Content Storage** - Keep records of what you sent
6. **User Isolated** - Each user has their own private history

---

## 🧪 Testing

### Test Workflow:

1. **Send a message from Search page:**
   - Go to Search → Generate messages → Send email/LinkedIn
   - Check Dashboard → Should appear in "Latest Attempts"

2. **Send a message from Drafts:**
   - Go to Drafts → Send a draft
   - Check Dashboard → Should appear in "Latest Attempts"

3. **Delete the draft:**
   - Go to Drafts → Delete the sent draft
   - Check Dashboard → **Should STILL appear in "Latest Attempts"!** ✅

4. **Check user isolation:**
   - Login as User A → Send messages → Check dashboard
   - Logout, login as User B → Should NOT see User A's messages
   - Login back as User A → Should see only User A's messages

---

## 🎉 Summary

✅ **Permanent history** - Outreach records persist forever  
✅ **Independent of drafts** - Delete drafts safely  
✅ **User-isolated** - Each user has private history  
✅ **Dashboard updated** - Fetches from history, not drafts  
✅ **All channels tracked** - Email, LinkedIn, or both  
✅ **Migration applied** - Database ready to use  

Your outreach history is now safe and permanent! 🚀

