import React from 'react';
import Link from 'next/link';

export default function Custom404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-900 text-white p-6">
      <div className="bg-blue-950 p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-5xl font-bold mb-4 text-yellow-400">404</h1>
        <h2 className="text-3xl font-bold mb-6">Page Not Found</h2>
        <p className="text-xl mb-8">
          Looks like you've ventured into an unknown category!
        </p>
        <Link 
          href="/"
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded inline-block"
        >
          Return to Game
        </Link>
      </div>
    </div>
  );
}