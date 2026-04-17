Original prompt: debug this jeopardy board and consider points of improvement and hardening

- 2026-04-03: Loaded the `develop-web-game` workflow and inspected project structure.
- 2026-04-03: Found an existing dirty worktree in `src/JeopardyGame.tsx` and `styles/globals.css`; treating current contents as baseline and avoiding unrelated reverts.
- 2026-04-03: Initial code scan shows a large client-side stateful board with localStorage persistence, import/export, AI generation, Daily Double flow, and mobile scroll locking. Next step is local reproduction and targeted fixes.
- 2026-04-03: Lean-build pass implemented:
  - Extracted shared board types into `src/jeopardyTypes.ts`.
  - Extracted default board/player helpers into `src/jeopardyDefaults.ts`.
  - Extracted question validation/logging helpers into `src/questionValidation.ts`.
  - Moved AI config + generation workflow out of `src/JeopardyGame.tsx` into lazy-loaded `src/AISettingsModal.tsx`.
  - Removed `src/App.tsx` and rendered the board directly from `pages/index.tsx`.
  - Simplified `pages/_app.tsx` to one wrapper path and moved font loading to `next/font/google`.
  - Removed the render-blocking Google Fonts CSS import from `styles/globals.css`.
- 2026-04-03: Verification status:
  - Basic file-level review completed on changed files.
  - Full `tsc` / `next build` verification was inconclusive in this environment because compiler commands did not return useful output before timing out/appearing to stall.
  - Next pass should run a real `npx tsc --noEmit` and `npm run build` in a normal local shell or unsandboxed session, then smoke-test the `Config` modal and board render.

- 2026-04-03: AI Settings modal redesigned ("Signal Intelligence" aesthetic):
  - Replaced dropdown provider selector with OpenRouter / Ollama pill tabs.
  - Added model chip grid (Google, OpenAI, DeepSeek, Qwen, Anthropic groupings).
  - Replaced range slider with labeled segmented temperature control (0.0 Precise → 1.0 Wild).
  - Added eye toggle for API key visibility.
  - Added char counters on system message and reference text areas.
  - Test Connection result inline beneath button; Save & Generate gold CTA.
  - Google Fonts (IBM Plex Mono + Barlow Condensed) loaded via CSS import.
  - Modal entrance animation (scale + blur → normal, 200ms).
  - Settings-trigger button renamed to "Config".

- 2026-04-03: User management backend added (SQLite):
  - Installed: `better-sqlite3`, `bcryptjs`, `jsonwebtoken` + type packages.
  - `lib/db.ts` — SQLite singleton, WAL mode, `users` + `boards` tables, auto-migration.
  - `lib/auth.ts` — JWT sign/verify, httpOnly cookie helpers, shared validation functions.
  - `pages/api/auth/register.ts` — create account (username + email + password, bcrypt cost 12).
  - `pages/api/auth/login.ts` — login by username or email.
  - `pages/api/auth/logout.ts` — clear session cookie.
  - `pages/api/auth/me.ts` — return current user from cookie.
  - `pages/api/boards/index.ts` — GET list / POST create board.
  - `pages/api/boards/[id].ts` — GET load / PUT update / DELETE board.
  - Removed `output: 'export'` from `next.config.js`; switched start script to `next start`.

- 2026-04-03: Admin seed script added:
  - `scripts/seed-admin.js` — creates or resets admin account; respects `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` env vars.
  - `npm run seed:admin` shortcut added to `package.json`.
  - Default credentials: `admin` / `Admin1234!` — change before production deploy.
  - `is_admin` column added to `users` table; JWT payload includes `isAdmin` flag.

- 2026-04-03: Registration flow hardened to industry standards:
  - Password policy: min 8 chars, 1 uppercase, 1 number (enforced in both API and seed script).
  - Live password strength bar (5 segments, color-coded Weak → Very Strong).
  - Password confirm field with live match indicator.
  - Live requirements checklist (4 rules, check marks on pass).
  - Login field accepts username or email.
  - Email uniqueness enforced at DB and API layer.
  - Username restricted to alphanumeric, `_`, `-`, 2–32 chars.

- 2026-04-03: Cloud boards UI added to toolbar:
  - "Sign In" button when logged out; "My Boards", "Save Board", username, "Sign Out" when logged in.
  - Auth modal with Sign In / Register tabs.
  - My Boards modal — lists saved boards with Load and Delete per row.
  - Save Board dialog — name input, saves full `gameState` JSON to server.
  - Dev server confirmed running (port 3001, 3000 was occupied); `tsc --noEmit` returned no errors.
