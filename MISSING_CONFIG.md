# Missing Configuration - What You Still Need

## ✅ Already Configured (from ananya/.env)

Your `backend/.env` has been populated with these values from `ananya/.env`:

- ✅ **Unipile API**: API key, account ID, and base URL
- ✅ **Apollo API**: API key for email extraction
- ✅ **OpenAI API**: API key for email generation
- ✅ **SMTP Configuration**: Gmail credentials (username, password, from email)
- ✅ **Database URL**: Default Docker Compose configuration
- ✅ **CORS**: Frontend URL configuration

## ⚠️ Still Required - Supabase Authentication

You need to obtain **3 values** from your Supabase dashboard:

### 1. SUPABASE_URL
- **Where to find**: Supabase Dashboard → Settings → API → Project URL
- **Format**: `https://xxxxx.supabase.co`
- **Example**: `https://abcdefghijklmnop.supabase.co`

### 2. SUPABASE_ANON_KEY
- **Where to find**: Supabase Dashboard → Settings → API → anon public key
- **Format**: Long JWT token starting with `eyJhbGc...`
- **Security**: This is the public key, safe to use in frontend

### 3. SUPABASE_JWT_SECRET
- **Where to find**: Supabase Dashboard → Settings → API → JWT Secret
- **Format**: Long secret string (different from anon key)
- **Security**: ⚠️ Keep this secret! Only use in backend

---

## 📝 Step-by-Step: Get Supabase Credentials

### Option A: If You Already Have a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one)
3. Navigate to **Settings** → **API**
4. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` (backend) and `VITE_SUPABASE_ANON_KEY` (frontend)
   - **service_role** secret → Don't use this! We need the JWT secret instead
5. Navigate to **Settings** → **Auth** → **JWT Settings**
6. Copy the **JWT Secret** → `SUPABASE_JWT_SECRET`

### Option B: Create a New Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **Start your project** or **New Project**
3. Sign in with GitHub (or create account)
4. Create a new project:
   - **Name**: "Cold Email" (or any name)
   - **Database Password**: Generate and save it (not needed for this app)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine
5. Wait for project to be created (~2 minutes)
6. Once ready, follow **Option A** steps above

---

## 🔧 Update Your Configuration Files

Once you have the Supabase credentials:

### 1. Update `backend/.env`

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

### 2. Update `frontend/.env`

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Same as backend
VITE_API_BASE_URL=http://localhost:8000
```

**Note**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in frontend should match the values in backend.

---

## ✅ Verification Checklist

Once you've added Supabase credentials:

- [ ] `backend/.env` has `SUPABASE_URL` filled in
- [ ] `backend/.env` has `SUPABASE_ANON_KEY` filled in
- [ ] `backend/.env` has `SUPABASE_JWT_SECRET` filled in
- [ ] `frontend/.env` has `VITE_SUPABASE_URL` filled in
- [ ] `frontend/.env` has `VITE_SUPABASE_ANON_KEY` filled in (same as backend)
- [ ] `frontend/.env` has `VITE_API_BASE_URL=http://localhost:8000`

---

## 🚀 After Adding Supabase Credentials

Once you've filled in the Supabase credentials, you can:

1. **Test the setup:**
   ```bash
   ./start-dev.sh
   ```

2. **Verify backend:**
   ```bash
   curl http://localhost:8000/healthz
   # Should return: {"ok":true}
   ```

3. **Access the app:**
   - Frontend: http://localhost:5173
   - Backend API Docs: http://localhost:8000/docs

4. **Set up authentication:**
   - In Supabase Dashboard → Authentication → Providers
   - Enable the auth providers you want (Email, Google, etc.)
   - Users can sign up/in through Supabase Auth

---

## 🔐 Security Notes

- ✅ **SUPABASE_ANON_KEY**: Safe to use in frontend (public)
- ⚠️ **SUPABASE_JWT_SECRET**: Keep secret! Only in backend `.env`
- ⚠️ **SMTP_PASSWORD**: Keep secret! This is your Gmail App Password
- ⚠️ **OPENAI_API_KEY**: Keep secret! Don't commit to git
- ⚠️ **UNIPILE_API_KEY**: Keep secret! Don't commit to git
- ⚠️ **APOLLO_API_KEY**: Keep secret! Don't commit to git

**Always add `.env` files to `.gitignore`!**

---

## 📞 Quick Reference

**Current Status:**
- ✅ 9 values configured from ananya/.env
- ⚠️ 3 Supabase values still needed

**Files to update:**
1. `backend/.env` - Add 3 Supabase values
2. `frontend/.env` - Add 2 Supabase values (URL and anon key)

**Time to complete:** ~5 minutes (if you have Supabase account) or ~10 minutes (creating new account)

