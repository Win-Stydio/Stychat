# Changelog

## [1.7.0] - 2026-10-24

### Changed
- Major visual refresh with a forest-green navigation rail, lighter editorial surfaces, floating rounded panels, clearer spacing, and refined chat bubbles.
- Reworked responsive layout styling for desktop, tablet, and mobile widths.
- Unified light and dark theme tokens while retaining the existing theme behavior.
- Preserved existing chat, group, profile, media, settings, and server interaction logic; this release focuses on presentation.

# Stychat 1.6.0

- Добавлен сохраняемый emoji-аватар в профиле.
- Добавлена отправка изображений, видео, аудио и PDF в личные и групповые чаты (до 8 МБ).
- Добавлена серверная загрузка файлов с UUID-именами и миграция базы данных.

# Changelog

## 1.5.1 - 2026-10-13

- Reworked the visual system across the entire app instead of applying minor color-only tweaks.
- Added a deep forest navigation rail with a brighter emerald brand mark and clearer active states.
- Rebuilt spacing, hierarchy, chat rows, search, filters, composer, message bubbles, and empty state styling.
- Refreshed authentication and modal surfaces and tuned compact layouts for mobile screens.
- Kept existing app components and application flows intact; this release is focused on UI and styling.

## 1.5.0
- Introduced a cohesive Stychat visual system with refreshed emerald branding, improved light/dark surfaces, and more consistent spacing and typography.
- Refined navigation rail, account card, search field, filters, conversation header, message bubbles, and composer.
- Added clearer hover/focus feedback, stronger selected-chat styling, responsive refinements, and reduced-motion support.
- Preserved the existing authentication, chat, group, search, settings, and paginated-history flows.
- Updated package and in-app version labels to 1.5.0.

## 1.1.0
- Added cursor-based history pagination for private and group conversations, loading 50 messages at a time instead of pulling hundreds of messages into the browser.
- Added a “Load previous messages” control when older history is available.
- Preserved the visible scroll position when older messages are prepended.
- Added input validation and a maximum page size of 100 messages to history endpoints.

## 1.0.7
- Fixed conversation history scrolling by constraining the conversation flex/grid area with `min-height: 0`.
- Added a dedicated scroll container with vertical scrolling and a visible, themed scrollbar.
- Prevented incoming messages from forcing the view to the newest message while the user is reading older history; auto-follow resumes near the bottom.

Changelog

## 1.0.6
- Drafts are kept separately for each private conversation and group, so switching chats no longer risks sending the wrong draft.
- Added local search across the currently loaded group conversation history.
- Group search filters visible messages and reports when no messages match.
- Private-message search remains server-backed and is not called while searching a group.

## 1.0.5

- Вынесены типы, API-клиент, форматирование дат и аватар в отдельные модули.
- Формы авторизации, настроек, профиля и создания группы вынесены в самостоятельные компоненты.
- Добавлено отдельное окно информации о группе со списком участников и переходом к карточке участника.
- Кнопки информации в групповом чате теперь открывают сведения о группе, а не форму создания группы.
- Добавлены типы `bcryptjs` и декларация типов Vite для чистой TypeScript-сборки.
- Приведены к единому стилю TypeScript/TSX и CSS исходники.


## 1.0.2 · Classic Social Edition

- Reworked the app shell into a classic messenger layout with a dedicated navigation rail, contact list, and conversation pane.
- Added a persistent light/dark theme setting.
- Replaced browser prompt profile editing with a settings panel.
- Added profile cards for users.
- Added group creation with name, description, and member selection.
- Added persistent group message history and Socket.IO realtime group messaging.
- Added responsive layout adjustments for smaller screens.
- Added SQLite tables for groups, memberships, and group messages. Existing direct messages and user accounts are retained.

## 1.0.1

- Refined the classic desktop layout, contact list, and chat pane.

## 1.0.0

- Initial Stychat 1.0 release based on the earlier MVP.

