# Stychat 1.7.0 design refresh

## Direction
Stychat keeps its recognizable forest-green identity while moving toward a more composed, modern messenger layout: a deep-green navigation rail, bright content surfaces, softer panel edges, improved spacing, and restrained shadows. The result takes inspiration from the clarity of classic desktop messengers without copying a specific product.

## Changes
- App frame now uses consistent outer gutters and separated rounded surfaces.
- Navigation rail has a more deliberate contrast and active-state treatment.
- Chat list, conversation header, message history, composer, and welcome state share a clearer surface hierarchy.
- Light and dark theme variables remain supported.
- Responsive rules are updated for narrow desktop, tablet, and mobile.

## Compatibility approach
This is a CSS-focused redesign. Existing React component structure, API calls, Socket.IO flow, authentication, group behavior, profile settings, media attachment handling, and message-history logic are intentionally left unchanged.

## Verification
Run `npm install` and `npm run build` locally. Then smoke-test login/register, personal and group chats, scrolling older messages, group details/member counts, profile/avatar settings, theme switching, and image/video/audio/PDF attachments.
