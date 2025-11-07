import { useState } from 'react'
import { Link } from 'react-router-dom'
import Auth from '../components/Auth'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('email') // 'email', 'auth'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-700/50">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('email')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            Email Accounts
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'auth'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            Authentication
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-2">Email Account Management</h2>
              <p className="text-sm text-gray-300 mb-4">
                Manage your linked email accounts to send messages from your own email addresses.
              </p>
            </div>
            <Link
              to="/dashboard/settings/email-accounts"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Manage Email Accounts →
            </Link>
          </div>
          
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-2">LinkedIn Account Management</h2>
              <p className="text-sm text-gray-300 mb-4">
                Connect your LinkedIn account to send messages and connection requests from your own LinkedIn profile.
                Unipile is still used for search and discovery.
              </p>
            </div>
            <Link
              to="/dashboard/settings/linkedin-accounts"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Manage LinkedIn Accounts →
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'auth' && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Authentication</h2>
          <Auth />
        </div>
      )}

      {/* Integrations Section */}
      <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Integrations</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-700/50 pb-4">
            <div>
              <h3 className="font-medium text-white">Unipile API Key</h3>
              <p className="text-sm text-gray-400">••••-last4</p>
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Edit
            </button>
          </div>
          <div className="flex items-center justify-between border-b border-gray-700/50 pb-4">
            <div>
              <h3 className="font-medium text-white">Apollo API Key</h3>
              <p className="text-sm text-gray-400">••••-last4</p>
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Edit
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">SMTP Configuration</h3>
              <p className="text-sm text-gray-400">smtp.gmail.com</p>
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Email Sending Domain */}
      <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Email Sending Domain</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Domain</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
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

