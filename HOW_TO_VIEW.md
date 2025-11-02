# How to View Frontend with Backend Connected

## ✅ Quick Answer

**Your frontend is already running!** Just open it in your browser:

👉 **http://localhost:5173**

The frontend is already configured to connect to the backend at `http://localhost:8000`.

---

## 🎯 What You'll See

When you open http://localhost:5173, you'll see:

1. **Sidebar Navigation**:
   - Dashboard
   - Search
   - Email
   - Pipeline
   - Settings

2. **Dashboard Page** (default):
   - KPI cards (Invites Sent, Emails Sent, Success Rate, Active Campaigns)
   - Latest Attempts table
   - All with mock data initially

3. **All Pages Work**:
   - Navigate between pages using the sidebar
   - Each page has its own functionality

---

## 🔧 Current Status

### ✅ Running
- **Frontend**: http://localhost:5173 (already running in your terminal)
- **Backend**: http://localhost:8000 (should be starting now)

### ⚠️ If Backend Has Errors

The backend might show import errors. I've fixed:
- ✅ Added `beautifulsoup4` to requirements and installed it
- ✅ Fixed import issues in `clients.py`

**If backend is still having issues**, you may need to restart it:

```bash
# In backend terminal, stop it (Ctrl+C) and restart:
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

---

## 🧪 Verify Backend is Working

### Test 1: Health Check
```bash
curl http://localhost:8000/healthz
# Should return: {"ok":true}
```

### Test 2: API Docs
Open in browser: **http://localhost:8000/docs**

### Test 3: Browser Console
1. Open frontend: http://localhost:5173
2. Open browser console (F12 → Console tab)
3. Check for any errors
4. If you see API errors, backend might not be ready yet

---

## 📱 View Frontend Now

### Option 1: Direct Access (Easiest)
1. Open your browser
2. Go to: **http://localhost:5173**
3. You should see the Kayrux Platform UI

### Option 2: Check What's Running
```bash
# Check if frontend is running
lsof -i :5173

# Check if backend is running  
lsof -i :8000

# Or open both URLs:
open http://localhost:5173
open http://localhost:8000/docs
```

---

## 🔗 How Frontend Connects to Backend

The connection is already configured in `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

The frontend uses this URL to make API calls to the backend.

---

## 🎉 Success Indicators

You know everything is working when:

1. ✅ Frontend loads at http://localhost:5173
2. ✅ You see the sidebar and navigation
3. ✅ Dashboard shows KPI cards and tables
4. ✅ Backend health check returns `{"ok":true}`
5. ✅ API docs load at http://localhost:8000/docs
6. ✅ No errors in browser console

---

## 🐛 If Frontend Can't Connect

### Check 1: Backend Running?
```bash
curl http://localhost:8000/healthz
```

### Check 2: CORS Configuration
Make sure `backend/.env` has:
```
CORS_ORIGINS=http://localhost:5173
```

### Check 3: Frontend API URL
Make sure `frontend/.env` has:
```
VITE_API_BASE_URL=http://localhost:8000
```

### Check 4: Browser Console
1. Open frontend
2. Press F12
3. Check Console tab for errors
4. Check Network tab for failed API calls

---

## 📋 Quick Checklist

- [ ] Frontend running at http://localhost:5173
- [ ] Backend running at http://localhost:8000
- [ ] Health check works: `curl http://localhost:8000/healthz`
- [ ] Frontend loads without errors
- [ ] Can navigate between pages
- [ ] No errors in browser console

---

## 🚀 Next Steps After Viewing

Once everything loads:

1. **Test Search Flow**: Go to Search page → Try searching for companies
2. **Test Email Editor**: Go to Email page → Try creating templates
3. **Test Dashboard**: Check if KPIs and tables load
4. **Test API**: Use the API docs at http://localhost:8000/docs to test endpoints

---

## ✨ You're Ready!

Just open **http://localhost:5173** in your browser and you'll see your full-stack application!

The frontend is already running and configured to connect to the backend. Once the backend finishes starting up (give it a few seconds), everything will work together seamlessly.

