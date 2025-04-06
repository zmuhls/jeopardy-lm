import React from 'react';
import JeopardyGame from './JeopardyGame';
import ErrorBoundary from './ErrorBoundary';

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <ErrorBoundary>
        <JeopardyGame />
      </ErrorBoundary>
    </main>
  );
}