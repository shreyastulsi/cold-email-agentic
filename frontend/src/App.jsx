import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import Messages from './pages/Messages'
import ResumeEditor from './pages/ResumeEditor'
import CampaignDetail from './pages/CampaignDetail'
import Settings from './pages/Settings'
import EmailAccounts from './pages/EmailAccounts'
import OAuthCallback from './pages/OAuthCallback'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />
        
        {/* OAuth callback - protected but no layout */}
        <Route
          path="/settings/email-accounts/oauth-callback"
          element={
            <ProtectedRoute>
              <OAuthCallback />
            </ProtectedRoute>
          }
        />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/resume" element={<ResumeEditor />} />
                  <Route path="/campaigns/:id" element={<CampaignDetail />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/email-accounts" element={<EmailAccounts />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

