import { BrowserRouter, Route, Routes } from 'react-router-dom'
import HeroSection from './components/hero-section'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import CampaignDetail from './pages/CampaignDetail'
import Dashboard from './pages/Dashboard'
import Drafts from './pages/Drafts'
import EmailAccounts from './pages/EmailAccounts'
import LinkedInAccounts from './pages/LinkedInAccounts'
import Loading from './pages/Loading'
import Login from './pages/Login'
import Messages from './pages/Messages'
import NotFound from './pages/NotFound'
import OAuthCallback from './pages/OAuthCallback'
import ResumeEditor from './pages/ResumeEditor'
import Search from './pages/Search'
import Settings from './pages/Settings'
import UnipileAuthSuccess from './pages/UnipileAuthSuccess'
import UnipileAuthFailure from './pages/UnipileAuthFailure'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HeroSection />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/loading" element={<Loading />} />
        
        {/* OAuth callback - protected but no layout */}
        <Route
          path="/settings/email-accounts/oauth-callback"
          element={
            <ProtectedRoute>
              <OAuthCallback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/linkedin-accounts/oauth-callback"
          element={
            <ProtectedRoute>
              <OAuthCallback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/linkedin-accounts/unipile-success"
          element={
            <ProtectedRoute>
              <UnipileAuthSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/linkedin-accounts/unipile-failure"
          element={
            <ProtectedRoute>
              <UnipileAuthFailure />
            </ProtectedRoute>
          }
        />
        
        {/* Protected routes - all dashboard routes */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="search" element={<Search />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="drafts" element={<Drafts />} />
                  <Route path="resume" element={<ResumeEditor />} />
                  <Route path="campaigns/:id" element={<CampaignDetail />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="settings/email-accounts" element={<EmailAccounts />} />
                  <Route path="settings/linkedin-accounts" element={<LinkedInAccounts />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* 404 - catch all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

