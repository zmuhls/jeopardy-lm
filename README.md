# JeopardyLM

JeopardyLM is an interactive, customizable Jeopardy-style game built with Next.js, React, and TypeScript. Ideal for teachers to create engaging quiz games with AI-generated questions, clues, and custom categories.

## Features

- **Interactive Jeopardy Game Board**: Classic Jeopardy-style gameplay with categories and tiered questions
- **AI-Generated Questions**: Create custom questions with multiple AI providers (Claude, GPT-4, Gemini, etc.)
- **Custom Content Integration**: Upload reference documents to generate subject-specific questions
- **Multiplayer Support**: Track scores for multiple players
- **Final Jeopardy Round**: Complete with wagers and dramatic reveal
- **Full Customization**: Create and edit your own categories and questions
- **Sound Effects**: Toggle-able audio feedback for correct/incorrect answers and timers
- **Error Handling**: Comprehensive error boundaries for a smooth user experience
- **Responsive Design**: Works on desktops, tablets, and mobile devices using Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v14 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/zmuhls/jeopardy-lm.git
   cd jeopardy-lm
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development Commands

- **Development server**: `npm run dev`
- **Production build**: `npm run build`
- **Static export**: `npm run export`
- **Start production build**: `npm run start`
- **Lint code**: `npm run lint`
- **Type check**: `npx tsc --noEmit`

## Troubleshooting

### API Integration
- Ensure you have valid API keys for your chosen AI provider
- API keys are stored locally in browser storage only
- If experiencing timeouts, try a different AI provider or check your network connection
- For reliability, consider generating questions in advance rather than during gameplay

### Question/Category Matching
- The application includes validation to ensure questions are properly matched with their categories
- If you experience any issues with mismatched questions, use the "Reset Game" feature to validate and fix the game state

## Classroom Applications

### Subject Review
- **Test Preparation**: Create a game with questions covering recent material to help students prepare for exams
- **Semester Review**: Use as an engaging review activity at the end of a semester

### Content-Specific Games
- **Literature Analysis**: Upload texts and generate questions about themes, characters, and plot points
- **Historical Events**: Create categories around specific time periods or historical movements
- **Scientific Concepts**: Reinforce understanding of complex scientific principles through gamification

### Collaborative Learning
- **Team-Based Competition**: Divide the class into teams to encourage collaboration and peer learning
- **Student-Created Games**: Have students create their own categories and questions as a learning activity

## AI Integration

JeopardyLM supports multiple AI providers:

- GPT-4 (OpenAI)
- Gemini (Google)
- Llama (Meta)
- Deepseek
- Mistral AI

To use AI-generated questions:

1. Click the "AI Settings & Generate" button
2. Select your preferred AI provider
3. Enter your API key (stored locally in browser storage only)
4. Customize the system message to guide question generation
5. Optionally upload reference documents
6. Click "Save & Generate"

### Recommended System Prompt

Use the following system prompt for the best AI-generated questions:

```
You are a Jeopardy game creator. Create Jeopardy! clues, categories, and questions as answers. Align with Jeopardy! clues in broad style and content. Design clues and question pairs to avoid ambiguity and slippage, accounting for doubled meanings and rough synonyms. Do not leave room for interpretation, and double-check that all clues and question pairs are indeed ground truth. Be concise, be challenging, be accessible.
```

## Technical Details

- Built with Next.js 13, React 18, and TypeScript
- Styled with Tailwind CSS for responsive design
- Uses React hooks for state management
- Implements error boundaries for graceful error handling
- Supports client-side rendering to prevent hydration issues with audio elements

## Building for Production

```
npm run build
npm run start
```

## GitHub Pages Deployment

This project is configured to deploy to GitHub Pages using GitHub Actions. When you push changes to the main branch, the site will automatically be built and deployed to https://zmuhls.github.io/jeopardy-lm/

## License

This project is licensed under the ISC License - see the LICENSE file for details.
