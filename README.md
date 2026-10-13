# Stychat 1.5.1 · Win Stydio Messenger

**Stychat by Win Stydio** is an independent web messenger with a refreshed desktop-messenger interface, profile cards, groups, configurable light/dark themes, and real-time messaging. Stychat has its own emerald visual identity and does not use Viber branding or assets.

## Stychat 1.5.1 visual refresh

- Cohesive emerald visual system across the navigation rail, sidebar, conversations, composer, dialogs, and sign-in screen.
- Clearer active-chat state, refined search and filter controls, smoother interaction feedback, and improved dark theme surfaces.
- Responsive layout refinements and reduced-motion accessibility support.

## What's included

- Account registration and login with bcryptjs password hashes and signed JWT sessions
- Persistent direct messages in SQLite and live delivery through Socket.IO
- Contact list, search, unread counters, read receipts, and typing indicator
- Public profile cards showing display name, username, and status
- Separate React components for authentication, settings, profile cards, group creation, and group details
- Settings panel with editable display name/status and persistent light/dark theme preference
- Group creation with a name, description, and selected members
- Group details window with a member list, creator label, and shortcuts to member profile cards
- Persistent group message history and real-time group messaging
- Emoji picker and responsive desktop/mobile layout
- Backward-compatible database initialization and migrations for existing accounts and direct messages

## Requirements

- Node.js 20 or newer
- npm

## Run on Windows (PowerShell)

1. Extract the ZIP and open PowerShell in the `Stychat` folder.
2. Install packages:

   ```powershell
   npm install
   ```

3. Create the API environment file if needed:

   ```powershell
   Copy-Item .env.example apps/api/.env
   ```

   If `apps/api/.env` already exists, keep it. Set `JWT_SECRET` to a long random secret before any public deployment.

4. Start the API and web client together:

   ```powershell
   npm run dev
   ```

5. Open `http://localhost:5173`. To test direct and group chats, create multiple accounts in separate browsers or a normal and private window.

The API runs on `http://localhost:3001`; its health endpoint is `http://localhost:3001/api/health`. The SQLite database is stored in `apps/api/data/stychat.sqlite` when started from the workspace root.

## Build

```powershell
npm run build
```

The API build output is written to `apps/api/dist` and the frontend output to `apps/web/dist`.

## Updating an existing Stychat folder

1. Stop Stychat.
2. Back up `apps/api/data/stychat.sqlite` and `apps/api/.env`.
3. Extract this archive into a **separate temporary folder** first.
4. Copy the source files into your project, but do not replace `.env` or the SQLite database.
5. Run `npm install` and `npm run dev`.

Group tables are created automatically when the API starts. Existing accounts and direct-message history are not intentionally deleted. Keep a backup before upgrading.

## Current limitations

This is an early milestone, not a production-ready replacement for Viber. It currently supports text-only direct and group chats. File uploads, avatar uploads, group member management after creation, push notifications, voice/video calls, end-to-end encryption, password recovery, email verification, rate limiting, moderation/reporting, and hardened production session handling are not included. The browser session token is stored in `localStorage`; use HTTPS, a strong secret, abuse controls, monitoring, backups, and a security review before public deployment.

Made by **Win Stydio**.
