# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JeopardyLM is an interactive, customizable Jeopardy-style game built with Next.js, React, and TypeScript. The application is designed for educational use, particularly for teachers to create engaging quiz games with AI-generated questions and custom categories.

## Development Commands

- **Development server**: `npm run dev` (runs on http://localhost:3000)
- **Production build**: `npm run build` (builds and exports static files)
- **Static export only**: `npm run export`
- **Serve production build**: `npm run start` (serves static files using `npx serve@latest out`)
- **Lint code**: `npm run lint`
- **Type checking**: `npx tsc --noEmit`

## Architecture & Key Components

### Application Structure
- **Next.js Pages Router**: Uses traditional pages directory structure
- **Static Export**: Configured with `output: 'export'` in next.config.js for static hosting
- **Client-Side Rendering**: Implements hydration-safe patterns to avoid SSR issues with audio elements

### Core Components
- **`src/JeopardyGame.tsx`**: Main game component containing all game logic, state management, and UI
- **`src/App.tsx`**: Application wrapper with client-side rendering logic
- **`src/ErrorBoundary.tsx`**: Error boundary component for graceful error handling
- **`pages/_app.tsx`**: Next.js app wrapper with global error handling and client-side rendering

### Game State Management
The game uses React's `useState` with complex state objects:
- **GameState**: Contains categories, players, current player, and final jeopardy status
- **Question Interface**: Includes text, answer, value, revealed/answered status, daily double flag, and ratings
- **Category Interface**: Contains title, questions array, and optional difficulty adjustments
- **Player Interface**: Name, score, and active status

### Key Features
- **AI Integration**: Supports multiple AI providers (GPT-4, Claude, Gemini, etc.) for question generation
- **Local Storage**: API keys stored in browser localStorage for security
- **Export/Import**: JSON-based game board export/import functionality
- **Sound Effects**: Toggle-able audio feedback system
- **Responsive Design**: Tailwind CSS for mobile-friendly layouts

## Deployment Configuration

### Static Export Setup
- Next.js configured for static export (`output: 'export'`)
- Images unoptimized for static hosting compatibility
- Build process combines `next build && next export`
- Production start uses `serve` package to host static files

### Railway Deployment
- Uses `npx serve@latest out` as start command
- Serves static files from `out` directory on port 3000 (or PORT environment variable)

### GitHub Pages
- Automatic deployment configured via GitHub Actions
- Deploys to `https://zmuhls.github.io/jeopardy-lm/`

## Development Notes

### Client-Side Rendering Pattern
Both `src/App.tsx` and `pages/_app.tsx` implement client-side rendering patterns using `useState` and `useEffect` to avoid hydration mismatches. This is critical for audio elements and dynamic content.

### Error Handling
- Global error boundaries catch React errors
- Unhandled promise rejection handling in `_app.tsx`
- Comprehensive error logging throughout the application

### AI Integration Architecture
- API keys never stored in code or committed to repository
- Multiple AI provider support with standardized interface
- Question generation includes validation and quality checks
- Reference document upload for context-specific question generation

## Code Conventions

- **TypeScript**: Strict typing with comprehensive interfaces
- **React Hooks**: Functional components with hooks for state management
- **Tailwind CSS**: Utility-first CSS with custom color extensions
- **File Organization**: Clear separation between pages, components, and utilities