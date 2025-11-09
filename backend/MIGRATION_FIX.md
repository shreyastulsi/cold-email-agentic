# Migration Fix Instructions

## Problem
The database has tables that already exist (like `drafts`), but we inserted a new migration (`add_unipile_account_id`) in the middle of the migration chain. This causes Alembic to try to re-create existing tables.

## Solution

### Step 1: Check Current State
Run the diagnostic script:
```bash
cd backend
./fix_migrations.sh
```

### Step 2: Stamp Database to Correct Revision

Since your database already has the `drafts` table, you need to stamp it to the correct revision. The safest approach:

1. **If the database has `drafts` table but NOT `user_settings` table:**
   ```bash
   # Stamp to the revision just before our new migration
   alembic stamp add_draft_sent_status_fields
   ```

2. **Then run the upgrade:**
   ```bash
   alembic upgrade head
   ```

### Alternative: Manual Fix

If the above doesn't work, you can manually check and stamp:

1. Check what revision the database thinks it's at:
   ```bash
   alembic current
   ```

2. Check what tables exist in your database (via psql or your database client)

3. Based on what exists, stamp to the appropriate revision:
   - If `drafts` exists → stamp to `add_draft_sent_status_fields`
   - If `user_settings` doesn't exist → you need to run the upgrade

4. Run upgrade:
   ```bash
   alembic upgrade head
   ```

## What the Fixes Do

1. **Migration Safety Checks**: All migrations now check if tables/columns exist before creating them
2. **Idempotent Migrations**: Migrations can be run multiple times safely
3. **Migration Chain**: Fixed the chain to be:
   - `add_linkedin_accounts` → `add_unipile_account_id` → `add_drafts_table` → `add_draft_sent_status_fields` → `add_user_settings_stats`

## After Migration

Once the migration completes successfully, you should have:
- ✅ `user_settings` table
- ✅ `user_stats` table  
- ✅ `unipile_account_id` column in `linkedin_accounts` table

Then you can test the new LinkedIn account sync functionality!

