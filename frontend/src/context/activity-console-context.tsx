import React, { createContext, useContext, useState, useCallback } from 'react'

interface ActivityConsoleContextValue {
  consoleWidth: number
  setConsoleWidth: (width: number) => void
}

const ActivityConsoleContext = createContext<ActivityConsoleContextValue | null>(null)

export function ActivityConsoleProvider({ children }: { children: React.ReactNode }) {
  const [consoleWidth, setConsoleWidth] = useState(0)

  return (
    <ActivityConsoleContext.Provider value={{ consoleWidth, setConsoleWidth }}>
      {children}
    </ActivityConsoleContext.Provider>
  )
}

export function useActivityConsole() {
  const context = useContext(ActivityConsoleContext)
  if (!context) {
    throw new Error('useActivityConsole must be used within ActivityConsoleProvider')
  }
  return context
}

