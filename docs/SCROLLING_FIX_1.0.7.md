# Stychat 1.0.7: conversation scrolling fix

Changes:
- The conversation column and history pane can now shrink inside the full-height grid (`min-height: 0`).
- The history pane scrolls vertically and hides horizontal overflow.
- New messages only auto-scroll when the reader is already near the bottom.
- Switching to another conversation resets the view to follow the latest messages.

After unpacking, run `npm install`, `npm run build`, then `npm run dev`.
