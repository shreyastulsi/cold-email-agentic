# Quick Authentication Setup - Fix 401 Errors

## 🚀 Fastest Way to Fix 401 Errors

### Step 1: Add Authentication Component

I've already created the Auth component and added it to your Settings page. Just refresh your frontend!

### Step 2: Create a Test User

**Option A: Via Supabase Dashboard (Easiest)**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Users**
4. Click **"Add User"** → **"Create new user"**
5. Enter:
   - Email: `test@example.com` (or your email)
   - Password: `testpassword123` (or any password)
   - Auto Confirm: **Check this** (so you don't need email verification)
6. Click **"Create User"**

**Option B: Via Frontend**

1. Go to http://localhost:5173/settings
2. You'll see the Auth component
3. Click **"Don't have an account? Sign up"**
4. Enter email and password
5. Click **"Sign Up"**
6. If email confirmation is enabled, check your email

### Step 3: Sign In

1. In Settings page, enter your email and password
2. Click **"Sign In"**
3. You should see "Signed in" message

### Step 4: Test Search

1. Go to Search page
2. Try searching for "Google" or any company
3. **401 errors should be gone!** ✅

---

## 🔍 What Happens

1. **Before auth**: API calls fail with 401
2. **After sign in**: Supabase provides JWT token
3. **Token is included**: Automatically added to all API requests
4. **Backend accepts**: JWT token is verified
5. **Search works!**: No more 401 errors

---

## 🐛 Troubleshooting

### "Supabase not configured" error

Check `frontend/.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### "Invalid credentials" error

- Check email/password are correct
- Make sure user exists in Supabase Dashboard
- Check if email confirmation is required

### Still getting 401 after sign in

1. **Check browser console** (F12) - Look for token errors
2. **Check Network tab** - See if Authorization header is being sent
3. **Verify Supabase JWT Secret** in `backend/.env` matches dashboard

### Can't create user

1. **Check Supabase Dashboard** → Authentication → Policies
2. **Enable Email provider** if not enabled
3. **Check "Enable email signups"** is on

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Settings page shows "Signed in" with email
2. ✅ Search page makes API calls without 401 errors
3. ✅ Browser console shows successful API requests
4. ✅ Network tab shows `Authorization: Bearer ...` header

---

## 🎯 Quick Checklist

- [ ] Supabase credentials in `frontend/.env`
- [ ] User created in Supabase (or signed up)
- [ ] Signed in from Settings page
- [ ] "Signed in" message visible
- [ ] Try search - no more 401!

**That's it! Once you sign in, all 401 errors will be gone.** 🚀

