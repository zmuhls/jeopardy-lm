import React, { useState, useEffect } from 'react';
import JeopardyGame from './JeopardyGame';
import ErrorBoundary from './ErrorBoundary';

export default function App() {
  // Add client-side only rendering to avoid hydration issues
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Show simple loading view until client-side rendered
  if (!isClient) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
        <div className="text-white text-2xl animate-pulse">Loading Jeopardy...</div>
      </main>
    );
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 lg:p-24 bg-black">
      <ErrorBoundary>
        <JeopardyGame />
      </ErrorBoundary>
    </main>
  );
}