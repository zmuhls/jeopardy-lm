# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Jeopardy-LM is an AI-powered Jeopardy game that uses large language models to generate questions and categories.

## Development Commands
- Start development server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Run tests: `npm test`

## Code Style
- Use TypeScript with proper typing
- React functional components with hooks
- Follow camelCase for variables/functions, PascalCase for components/interfaces
- Store API keys in environment variables, not in code
- Use async/await for API calls with proper error handling
- Add JSDoc comments for functions and complex logic

## API Cost Optimization Plan
1. Implement content caching to store previously generated questions
2. Create background generation system to pre-generate content during idle time
3. Develop batch API request handler to group similar requests
4. Add smart pre-generation based on user preferences and patterns
5. Integrate UI feedback for cached vs. generated content