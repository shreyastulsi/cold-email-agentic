# How to Fix 401 Authentication Errors

## 🔍 The Problem

You're getting **401 Unauthorized** errors because:

1. ✅ **Backend is working** - Endpoints are accessible
2. ✅ **Frontend is making API calls** - Requests are being sent
3. ⚠️ **No authentication token** - Backend requires Supabase JWT tokens
4. ⚠️ **All endpoints require auth** - Need to authenticate first

---

## 🚀 Solution: Set Up Supabase Authentication

### Option 1: Quick Setup (Recommended)

I've created an authentication component. Add it to your app:

**Step 1: Add Auth component to a page (e.g., Settings)**

Edit `frontend/src/pages/Settings.jsx` to include authentication:

```jsx
import Auth from '../components/Auth'

// Add <Auth /> component to Settings page
```

**Step 2: Create a test user in Supabase**

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Click **"Add User"** → **"Create new user"**
4. Enter email and password
5. Create the user

**Step 3: Sign in from frontend**

1. Go to Settings page in your app
2. Sign in with the email/password you created
3. Now all API calls will include the JWT token automatically!

---

### Option 2: Use Supabase Dashboard Auth UI

1. Go to Supabase Dashboard → **Authentication** → **Policies**
2. Enable "Enable email provider" if not already enabled
3. Users can sign up directly from your app

---

### Option 3: Temporary Testing (Skip Auth for Testing)

If you just want to test endpoints without auth, you can temporarily modify the backend to skip authentication for testing:

**⚠️ WARNING: Only for development testing! Remove this before production!**

Edit `backend/app/api/v1/search.py`:

```python
# Option 1: Make auth optional
@router.post("/search/company")
async def search_company_endpoint(
    request: CompanySearchRequest,
    current_user: Optional[User] = Depends(get_current_user)
) -> dict:
    # Use mock user if no auth
    # ...
```

Or create a dev-only dependency:

```python
# In deps.py
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    if credentials:
        return await get_current_user(credentials)
    # Return mock user for testing
    return User(id="test", email="test@test.com")
```

---

## ✅ What I've Already Done

1. ✅ **Created Supabase client** (`frontend/src/utils/supabase.js`)
   - Handles authentication
   - Gets JWT tokens from sessions
   - Provides sign in/up/out functions

2. ✅ **Updated API utility** (`frontend/src/utils/api.js`)
   - Now automatically gets JWT token from Supabase
   - Includes token in Authorization header
   - Better error messages for 401

3. ✅ **Created Auth component** (`frontend/src/components/Auth.jsx`)
   - Sign in/Sign up form
   - User session management
   - Ready to use!

---

## 📋 Step-by-Step: Get Authentication Working

### Step 1: Enable Email Auth in Supabase

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. Save settings

### Step 2: Create Test User

**Option A: Via Dashboard**
1. Go to **Authentication** → **Users**
2. Click **"Add User"**
3. Create user with email/password

**Option B: Via Frontend** (once Auth component is added)
1. Go to Settings page
2. Click "Sign Up"
3. Enter email and password
4. Check email for verification link (if email confirmation is enabled)

### Step 3: Add Auth to Your App

Add the Auth component to your Settings page or create a dedicated auth page:

```jsx
// In Settings.jsx or create AuthPage.jsx
import Auth from '../components/Auth'

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      
      {/* Add Auth component */}
      <Auth />
      
      {/* Rest of settings... */}
    </div>
  )
}
```

### Step 4: Sign In

1. Open your app → Settings (or wherever you added Auth)
2. Enter email and password
3. Click "Sign In"
4. You should see "Signed in" message

### Step 5: Test Search

1. Now go to Search page
2. Try searching for a company
3. It should work! (401 errors should be gone)

---

## 🧪 Quick Test Without Full Auth Setup

If you want to test quickly without setting up full auth:

**Temporary: Use a test token**

1. Get a test JWT from Supabase:
   - Sign in via Supabase Dashboard
   - Use browser DevTools → Application → Local Storage
   - Find Supabase token

2. Or create a simple token tester page:

```jsx
// Add to Settings page temporarily
const [token, setToken] = useState('')

// Test with token input
<input 
  value={token}
  onChange={(e) => {
    setToken(e.target.value)
    localStorage.setItem('test_token', e.target.value)
  }}
  placeholder="Paste JWT token here"
/>
```

---

## 🔍 Verify Authentication is Working

### Check 1: User is logged in
```javascript
// In browser console
import { getCurrentUser } from './utils/supabase'
getCurrentUser().then(console.log)
```

### Check 2: Token is available
```javascript
// In browser console
import { getSessionToken } from './utils/supabase'
getSessionToken().then(console.log)
// Should show JWT token string
```

### Check 3: API call includes token
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try searching for a company
4. Click on the request → Headers
5. Should see: `Authorization: Bearer eyJ...`

---

## 🎯 Recommended Approach

**Best way to get it working:**

1. **Add Auth component to Settings page** (I've created it)
2. **Create test user in Supabase Dashboard**
3. **Sign in from frontend**
4. **Try search again** - should work!

---

## 📝 Quick Code to Add

**To Settings page:**

```jsx
// frontend/src/pages/Settings.jsx
import Auth from '../components/Auth'

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      
      {/* Authentication */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Authentication</h2>
        <Auth />
      </div>
      
      {/* Rest of settings... */}
    </div>
  )
}
```

---

## ✅ Summary

- ✅ Supabase client is set up
- ✅ Auth component is created
- ✅ API calls now include tokens automatically
- ⚠️ **You need to**: Add Auth component and sign in!

Once you sign in, all 401 errors will be gone and search will work! 🚀

