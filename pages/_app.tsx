import '../styles/globals.css';
import type { AppProps } from 'next/app';
import ErrorBoundary from '../src/ErrorBoundary';
import { useState, useEffect } from 'react';

export default function MyApp({ Component, pageProps }: AppProps) {
  // Use client-side only rendering to avoid hydration issues with audio elements
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    
    // Global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Prevent the default browser behavior (console error)
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (!isClient) {
    // Return a simple loading state during SSR to avoid hydration issues
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-pulse text-white text-2xl">Loading Jeopardy AI...</div>
    </div>;
  }

  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}