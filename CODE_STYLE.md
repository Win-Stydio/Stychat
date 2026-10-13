# Stychat source code readability

This edition keeps the existing app behavior and adds consistent source formatting settings.

## Source layout

- `apps/web/src/App.tsx` — messenger interface and client-side chat state.
- `apps/web/src/style.css` — visual styles and light/dark themes.
- `apps/web/src/main.tsx` — browser entry point.
- `apps/api/src/index.ts` — Express API, authentication, SQLite persistence, and Socket.IO events.
- `docs/ARCHITECTURE.md` — architecture overview.
- `docs/ROADMAP.md` — planned development.

## Formatting

All source files use UTF-8 and LF line endings. Prettier is included as a root development dependency.
After installing dependencies, run from the project root:

```powershell
npm install
npm run format
```

To check formatting without changing files:

```powershell
npm run format:check
```

Formatting changes whitespace and line breaks only. It is not intended to change app behavior.
