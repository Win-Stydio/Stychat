# Architecture

- **Web:** React + TypeScript + Vite. REST requests use bearer JWTs; Socket.IO handles real-time events.
- **API:** Express REST endpoints and Socket.IO server share the same HTTP server.
- **Persistence:** SQLite stores account hashes and messages. A message is written before the server broadcasts it.
- **Authentication:** bcrypt hashes passwords; JWTs identify the account for API requests and socket connections.
- **Conversation model:** one-to-one messages are stored as sender/recipient pairs. A client fetches history from `/api/messages/:userId` and listens for `message:new`.

For production, add request throttling, robust schema validation, migrations, monitoring, HTTPS, a secure session strategy, and a reviewed privacy/security model.

## Frontend modules (1.5.0)

- `src/types.ts` contains shared domain types.
- `src/lib/api.ts` contains the API base URL and typed HTTP helper.
- `src/utils/format.ts` contains reusable display formatting helpers.
- `src/components/Avatar.tsx` contains the shared avatar component.
- `src/components/GroupDetailsModal.tsx` loads and displays group members and lets a user open a member profile.
- `src/App.tsx` coordinates the main application state and navigation.

## Visual system (1.5.0)

The stylesheet defines the shared emerald visual identity for navigation, chat surfaces, forms, message bubbles, and responsive states. The visual refresh is implemented in CSS and does not replace API or chat behavior.
