# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- **Development server**: `npm run dev`
- **Production build**: `npm run build`
- **Static export**: `npm run export`
- **Start production**: `npm run start`
- **Lint code**: `npm run lint`
- **Type check**: `npx tsc --noEmit`

## Code Style Guidelines
- **Imports**: Group imports (React, then third-party, then local)
- **Components**: PascalCase for component names and files
- **TypeScript**: Use explicit type definitions with interfaces
- **Formatting**: Use consistent indentation (2 spaces)
- **Error handling**: Use try/catch blocks with appropriate error messages
- **State management**: Prefer useState/useEffect hooks
- **Audio elements**: Handle with appropriate error boundaries
- **Responsive design**: Use Tailwind CSS classes
- **CSS naming**: Use kebab-case for CSS class names

## Project Structure
- **pages/**: Next.js page components
- **src/**: Core application components
- **public/**: Static assets (images, sounds)
- **styles/**: Global CSS and Tailwind configuration