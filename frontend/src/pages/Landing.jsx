import React from 'react'
import { HeroHeader } from '../components/header'

function Landing() {
  return (
    <div className="min-h-screen">
      <HeroHeader />
      <main className="pt-20">
        {/* Landing page content will go here */}
        <div className="container mx-auto px-6 py-20">
          <h1 className="text-4xl font-bold mb-4">Welcome to Cold Email Agentic</h1>
          <p className="text-lg text-muted-foreground">
            Your intelligent cold email outreach platform
          </p>
        </div>
      </main>
    </div>
  )
}

export default Landing
