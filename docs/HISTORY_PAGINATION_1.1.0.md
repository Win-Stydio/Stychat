# Stychat 1.1.0: conversation history pagination

## What changed

- Private and group message history now loads the latest 50 messages first.
- The API accepts `limit` (capped at 100) and `beforeId` cursor parameters.
- The API returns `hasMore` so the client can tell whether older history remains.
- Older messages are prepended without jumping the reading position.
- Private history is marked as read only on the initial/latest-history request, not every time older pages are loaded.

## Smoke-test checklist

1. Start the API and web app using `npm run dev`.
2. Open a conversation with more than 50 messages. The latest messages should appear first.
3. Click “↑ Загрузить предыдущие сообщения”. Older messages should appear above and the viewport should stay anchored near the same message.
4. Repeat in a group chat with more than 50 messages.
5. Verify short conversations do not show the load-history control.
6. Verify users still cannot read a group history unless they are group members.
