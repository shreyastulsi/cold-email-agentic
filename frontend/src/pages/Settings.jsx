import { useState } from 'react'
import { Link } from 'react-router-dom'
import Auth from '../components/Auth'
import ResumeUpload from '../components/ResumeUpload'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('resume') // 'resume', 'email', 'auth'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('resume')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'resume'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Resume
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Email Accounts
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'auth'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Authentication
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'resume' && (
        <div>
          <ResumeUpload />
        </div>
      )}

      {activeTab === 'email' && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Email Account Management</h2>
            <p className="text-sm text-gray-600 mb-4">
              Manage your linked email accounts to send messages from your own email addresses.
            </p>
          </div>
          <Link
            to="/settings/email-accounts"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Manage Email Accounts →
          </Link>
        </div>
      )}

      {activeTab === 'auth' && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Authentication</h2>
          <Auth />
        </div>
      )}

      {/* Integrations Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Integrations</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <h3 className="font-medium text-gray-900">Unipile API Key</h3>
              <p className="text-sm text-gray-500">••••-last4</p>
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Edit
            </button>
          </div>
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <h3 className="font-medium text-gray-900">Apollo API Key</h3>
              <p className="text-sm text-gray-500">••••-last4</p>
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Edit
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">SMTP Configuration</h3>
              <p className="text-sm text-gray-500">smtp.gmail.com</p>
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Email Sending Domain */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Email Sending Domain</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Domain</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              defaultValue="example.com"
            />
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

