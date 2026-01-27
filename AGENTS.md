# Repository Guidelines

## Project Structure & Module Organization
- `src/routes/` holds SvelteKit routes for `/`, `/live`, `/upload`, and `/summary` views.
- `src/lib/` is the shared app core: `components/` UI, `services/` frame/inference logic, `stores/` state, `types/` shared TS types, `assets/` local assets.
- `static/` stores public files served as-is (e.g., models, icons).
- `src/app.css`, `src/app.html`, and `src/app.d.ts` define global styling and app shell.

## Build, Test, and Development Commands
- `npm run dev`: start Vite dev server (HTTPS required for camera access).
- `npm run build`: production build.
- `npm run preview`: serve the production build locally.
- `npm run check`: type-check via `svelte-check` after `svelte-kit sync`.
- `npm run check:watch`: continuous type-checking in watch mode.

## Coding Style & Naming Conventions
- Svelte 5 runes are required: `$state()`, `$derived()`, `$effect()`.
- No SSR: `src/routes/+layout.ts` sets `ssr = false`; keep code client-only.
- Do not mutate stores directly; use helper functions exported from `src/lib/stores/index.ts`.
- File naming: components `PascalCase.svelte`, services/stores `camelCase.ts`, types in `src/lib/types/index.ts`.
- Units: angles (deg), velocity (m/s), height (in). Use `performance.now()` for frame timing and `Date.now()` for session state.

## Testing Guidelines
- No automated test framework is configured yet. Validate manually:
  - Live mode on a mobile device over HTTPS (camera permissions).
  - Upload mode using golden clips (see CSV references in `CLAUDE.md`).
- If adding tests, document the framework and update this file with commands and naming rules.

## Commit & Pull Request Guidelines
- Git history is not available in this workspace, so no commit convention can be inferred.
- Use clear, imperative commit messages (e.g., "Add viterbi decoder stub").
- PRs should include: purpose, key changes, screenshots for UI changes, and linked issues when applicable.

## Architecture & Runtime Notes
- Client-only SvelteKit PWA focused on real-time video ingest and overlays.
- Core pipeline entry: `src/lib/services/videoIngest.ts`.
- Keep UI responsive; avoid blocking the main thread during inference.