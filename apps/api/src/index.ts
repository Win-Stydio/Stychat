import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-this-secret';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const dataDir = path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'stychat.sqlite'));
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Доступен для общения',
    avatar_emoji TEXT NOT NULL DEFAULT '🙂',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
  );
  CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages(sender_id, recipient_id, id);
  CREATE TABLE IF NOT EXISTS chat_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    owner_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS group_messages_idx ON group_messages(group_id, id);
`);
// Backward-compatible migrations for databases created by Stychat 0.1.
const userColumns = db.prepare('PRAGMA table_info(users)').all() as {
    name: string;
}[];
if (!userColumns.some(column => column.name === 'display_name'))
    db.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
if (!userColumns.some(column => column.name === 'status'))
    db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'Доступен для общения'");
if (!userColumns.some(column => column.name === 'avatar_emoji'))
    db.exec("ALTER TABLE users ADD COLUMN avatar_emoji TEXT NOT NULL DEFAULT '🙂'");
const messageColumns = db.prepare('PRAGMA table_info(messages)').all() as {
    name: string;
}[];
if (!messageColumns.some(column => column.name === 'read_at'))
    db.exec('ALTER TABLE messages ADD COLUMN read_at TEXT');
type AuthUser = {
    id: number;
    username: string;
};
type PublicUser = AuthUser & {
    displayName: string;
    status: string;
    avatarEmoji: string;
};
type AuthedRequest = Request & {
    user?: AuthUser;
};
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] } });
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '7d' }));
function makeToken(user: AuthUser) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}
function readToken(token: string): AuthUser {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    if (typeof decoded.id !== 'number' || typeof decoded.username !== 'string')
        throw new Error('Invalid token');
    return { id: decoded.id, username: decoded.username };
}
function auth(req: AuthedRequest, res: Response, next: NextFunction) {
    const value = req.headers.authorization;
    if (!value?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Please sign in.' });
    try {
        req.user = readToken(value.slice(7));
        next();
    }
    catch {
        return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
}
function safeUser(row: {
    id: number;
    username: string;
    display_name?: string;
    status?: string;
    avatar_emoji?: string;
}): PublicUser { return { id: row.id, username: row.username, displayName: row.display_name || row.username, status: row.status || 'Доступен для общения', avatarEmoji: row.avatar_emoji || '🙂' }; }
function validUsername(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(value); }
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Stychat API' }));
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!validUsername(username))
        return res.status(400).json({ error: 'Username must be 3–20 characters: letters, numbers, underscore.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 128)
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as {
        id: number;
    } | undefined;
    if (existing)
        return res.status(409).json({ error: 'That username is already taken.' });
    const passwordHash = await bcrypt.hash(password, 12);
    try {
        const result = db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)').run(username, passwordHash, username);
        const user = { id: Number(result.lastInsertRowid), username };
        return res.status(201).json({ token: makeToken(user), user: safeUser({ ...user, display_name: username, status: 'Доступен для общения' }) });
    }
    catch {
        return res.status(409).json({ error: 'That username is already taken.' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string')
        return res.status(400).json({ error: 'Enter your username and password.' });
    const row = db.prepare('SELECT id, username, password_hash, display_name, status, avatar_emoji FROM users WHERE username = ?').get(username) as {
        id: number;
        username: string;
        password_hash: string;
        display_name: string;
        status: string;
        avatar_emoji: string;
    } | undefined;
    if (!row || !(await bcrypt.compare(password, row.password_hash)))
        return res.status(401).json({ error: 'Incorrect username or password.' });
    const user = safeUser(row);
    return res.json({ token: makeToken(user), user: safeUser(row) });
});
app.get('/api/profile', auth, (req: AuthedRequest, res) => {
    const row = db.prepare('SELECT id, username, display_name, status, avatar_emoji FROM users WHERE id = ?').get(req.user!.id) as {
        id: number;
        username: string;
        display_name: string;
        status: string;
    } | undefined;
    if (!row)
        return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: safeUser(row) });
});
app.patch('/api/profile', auth, (req: AuthedRequest, res) => {
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    const avatarEmoji = typeof req.body?.avatarEmoji === 'string' ? req.body.avatarEmoji : '🙂';
    const allowedAvatars = ['🙂','😀','😎','🥹','😍','🤓','😴','🤠','🦊','🐱','🐼','🐸','🐧','🦄','🐙','🐻','🌻','🍀','🍓','🌈','⭐','🚀','🎧','💚'];
    if (!allowedAvatars.includes(avatarEmoji)) return res.status(400).json({ error: 'Выбери смайлик из списка.' });
    if (displayName.length < 1 || displayName.length > 32)
        return res.status(400).json({ error: 'Display name must be 1–32 characters.' });
    if (status.length > 80)
        return res.status(400).json({ error: 'Status must be at most 80 characters.' });
    db.prepare('UPDATE users SET display_name = ?, status = ?, avatar_emoji = ? WHERE id = ?').run(displayName, status || 'Доступен для общения', avatarEmoji, req.user!.id);
    const row = db.prepare('SELECT id, username, display_name, status, avatar_emoji FROM users WHERE id = ?').get(req.user!.id) as {
        id: number;
        username: string;
        display_name: string;
        status: string;
    };
    const user = safeUser(row);
    io.emit('profile:updated', user);
    res.json({ user });
});
app.post('/api/media', auth, (req: AuthedRequest, res) => {
    const { name, mimeType, data } = req.body ?? {};
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'application/pdf']);
    if (typeof mimeType !== 'string' || !allowedTypes.has(mimeType) || typeof data !== 'string')
        return res.status(400).json({ error: 'Поддерживаются изображения, видео, аудио и PDF.' });
    const match = data.match(/^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1] !== mimeType) return res.status(400).json({ error: 'Файл имеет неверный формат.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Максимальный размер файла: 8 МБ.' });
    const extByType: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/webm': '.webm', 'application/pdf': '.pdf' };
    const filename = `${randomUUID()}${extByType[mimeType]}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer, { flag: 'wx' });
    const safeName = typeof name === 'string' ? name.slice(0, 160).replace(/[\r\n]/g, '') : filename;
    res.status(201).json({ url: `/uploads/${filename}`, name: safeName, mimeType, size: buffer.length });
});
app.get('/api/users', auth, (req: AuthedRequest, res) => {
    const rows = db.prepare('SELECT id, username, display_name, status, avatar_emoji FROM users WHERE id != ? ORDER BY username COLLATE NOCASE').all(req.user!.id) as {
        id: number;
        username: string;
        display_name: string;
        status: string;
    }[];
    res.json({ users: rows.map(safeUser) });
});
app.get('/api/groups', auth, (req: AuthedRequest, res) => {
    const rows = db.prepare(`SELECT g.id, g.name, g.description, g.owner_id AS ownerId,
    (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS memberCount
    FROM chat_groups g JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ? ORDER BY g.id DESC`).all(req.user!.id);
    res.json({ groups: rows });
});
app.post('/api/groups', auth, (req: AuthedRequest, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 48) : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 180) : '';
    const ids = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0 && id !== req.user!.id) : [];
    if (name.length < 2)
        return res.status(400).json({ error: 'Название группы должно содержать минимум 2 символа.' });
    const create = db.transaction(() => {
        const result = db.prepare('INSERT INTO chat_groups (name, description, owner_id) VALUES (?, ?, ?)').run(name, description, req.user!.id);
        const groupId = Number(result.lastInsertRowid);
        const add = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)');
        add.run(groupId, req.user!.id, 'owner');
        for (const id of [...new Set(ids)]) {
            if (db.prepare('SELECT id FROM users WHERE id = ?').get(id))
                add.run(groupId, id, 'member');
        }
        return groupId;
    });
    const groupId = create();
    const group = db.prepare(`SELECT g.id, g.name, g.description, g.owner_id AS ownerId,
    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS memberCount FROM chat_groups g WHERE g.id = ?`).get(groupId);
    const members = db.prepare('SELECT user_id AS userId FROM group_members WHERE group_id = ?').all(groupId) as {
        userId: number;
    }[];
    for (const member of members)
        io.to(`user:${member.userId}`).emit('groups:updated', group);
    res.status(201).json({ group });
});
app.get('/api/groups/:groupId/messages', auth, (req: AuthedRequest, res) => {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId) || groupId < 1)
        return res.status(400).json({ error: 'Некорректная группа.' });
    const membership = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user!.id);
    if (!membership)
        return res.status(403).json({ error: 'У вас нет доступа к этой группе.' });
    const limitValue = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(limitValue, 100)) : 50;
    const beforeIdValue = req.query.beforeId === undefined ? null : Number(req.query.beforeId);
    if (beforeIdValue !== null && (!Number.isInteger(beforeIdValue) || beforeIdValue < 1))
        return res.status(400).json({ error: 'Некорректная позиция истории.' });
    const rows = beforeIdValue === null
        ? db.prepare(`SELECT gm.id, gm.group_id AS groupId, gm.sender_id AS senderId, gm.body, gm.created_at AS createdAt,
            u.username AS senderUsername, u.display_name AS senderDisplayName FROM group_messages gm JOIN users u ON u.id = gm.sender_id
            WHERE gm.group_id = ? ORDER BY gm.id DESC LIMIT ?`).all(groupId, limit + 1)
        : db.prepare(`SELECT gm.id, gm.group_id AS groupId, gm.sender_id AS senderId, gm.body, gm.created_at AS createdAt,
            u.username AS senderUsername, u.display_name AS senderDisplayName FROM group_messages gm JOIN users u ON u.id = gm.sender_id
            WHERE gm.group_id = ? AND gm.id < ? ORDER BY gm.id DESC LIMIT ?`).all(groupId, beforeIdValue, limit + 1);
    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();
    res.json({ messages, hasMore });
});
app.get('/api/groups/:groupId/members', auth, (req: AuthedRequest, res) => {
    const groupId = Number(req.params.groupId);
    const membership = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user!.id);
    if (!membership)
        return res.status(403).json({ error: 'У вас нет доступа к этой группе.' });
    const members = db.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.status, gm.role
    FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? ORDER BY gm.role DESC, u.username`).all(groupId);
    res.json({ members });
});
app.get('/api/unread', auth, (req: AuthedRequest, res) => {
    const rows = db.prepare('SELECT sender_id AS userId, COUNT(*) AS count FROM messages WHERE recipient_id = ? AND read_at IS NULL GROUP BY sender_id').all(req.user!.id) as {
        userId: number;
        count: number;
    }[];
    res.json({ unread: Object.fromEntries(rows.map(row => [row.userId, row.count])) });
});
app.get('/api/search', auth, (req: AuthedRequest, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (query.length < 2)
        return res.json({ messages: [] });
    const rows = db.prepare(`SELECT m.id, m.sender_id AS senderId, m.recipient_id AS recipientId, CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS otherUserId, m.body, m.created_at AS createdAt, m.read_at AS readAt, u.username AS senderUsername FROM messages m JOIN users u ON u.id = m.sender_id WHERE (m.sender_id = ? OR m.recipient_id = ?) AND m.body LIKE ? ORDER BY m.id DESC LIMIT 100`).all(req.user!.id, req.user!.id, req.user!.id, `%${query}%`) as unknown[];
    res.json({ messages: rows });
});
app.get('/api/messages/:userId', auth, (req: AuthedRequest, res) => {
    const recipientId = Number(req.params.userId);
    if (!Number.isInteger(recipientId) || recipientId < 1 || recipientId === req.user!.id)
        return res.status(400).json({ error: 'Invalid conversation.' });
    const limitValue = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(limitValue, 100)) : 50;
    const beforeIdValue = req.query.beforeId === undefined ? null : Number(req.query.beforeId);
    if (beforeIdValue !== null && (!Number.isInteger(beforeIdValue) || beforeIdValue < 1))
        return res.status(400).json({ error: 'Invalid history cursor.' });
    if (beforeIdValue === null) {
        db.prepare('UPDATE messages SET read_at = datetime(\'now\') WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL').run(recipientId, req.user!.id);
        io.to(`user:${recipientId}`).emit('messages:read', { byUserId: req.user!.id, conversationUserId: recipientId });
    }
    const baseQuery = `SELECT m.id, m.sender_id AS senderId, m.recipient_id AS recipientId, m.body,
        m.created_at AS createdAt, m.read_at AS readAt, u.username AS senderUsername
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))`;
    const rows = beforeIdValue === null
        ? db.prepare(`${baseQuery} ORDER BY m.id DESC LIMIT ?`).all(req.user!.id, recipientId, recipientId, req.user!.id, limit + 1)
        : db.prepare(`${baseQuery} AND m.id < ? ORDER BY m.id DESC LIMIT ?`).all(req.user!.id, recipientId, recipientId, req.user!.id, beforeIdValue, limit + 1);
    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();
    res.json({ messages, hasMore });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string')
        return next(new Error('Authentication required'));
    try {
        socket.data.user = readToken(token);
        next();
    }
    catch {
        next(new Error('Invalid or expired session'));
    }
});
io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(`user:${user.id}`);
    socket.on('typing:start', (recipientValue: unknown) => {
        const recipientId = Number(recipientValue);
        if (Number.isInteger(recipientId) && recipientId > 0 && recipientId !== user.id) {
            io.to(`user:${recipientId}`).emit('typing:update', { userId: user.id, username: user.username, typing: true });
        }
    });
    socket.on('typing:stop', (recipientValue: unknown) => {
        const recipientId = Number(recipientValue);
        if (Number.isInteger(recipientId) && recipientId > 0 && recipientId !== user.id) {
            io.to(`user:${recipientId}`).emit('typing:update', { userId: user.id, username: user.username, typing: false });
        }
    });
    socket.on('group:message:send', (payload: unknown, ack?: (result: unknown) => void) => {
        const fail = (error: string) => ack?.({ ok: false, error });
        if (!payload || typeof payload !== 'object')
            return fail('Некорректное сообщение.');
        const data = payload as {
            groupId?: unknown;
            body?: unknown;
        };
        const groupId = Number(data.groupId);
        if (!Number.isInteger(groupId) || groupId < 1)
            return fail('Выбери группу.');
        if (typeof data.body !== 'string' || !data.body.trim() || data.body.length > 2000)
            return fail('Сообщение должно содержать от 1 до 2000 символов.');
        const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.id);
        if (!member)
            return fail('У тебя нет доступа к этой группе.');
        const result = db.prepare('INSERT INTO group_messages (group_id, sender_id, body) VALUES (?, ?, ?)').run(groupId, user.id, data.body.trim());
        const row = db.prepare(`SELECT gm.id, gm.group_id AS groupId, gm.sender_id AS senderId, gm.body, gm.created_at AS createdAt,
      u.username AS senderUsername, u.display_name AS senderDisplayName FROM group_messages gm JOIN users u ON u.id = gm.sender_id WHERE gm.id = ?`).get(Number(result.lastInsertRowid)) as Record<string, unknown>;
        const memberRows = db.prepare('SELECT user_id AS userId FROM group_members WHERE group_id = ?').all(groupId) as {
            userId: number;
        }[];
        for (const memberRow of memberRows)
            io.to(`user:${memberRow.userId}`).emit('group:message:new', row);
        ack?.({ ok: true, message: row });
    });
    socket.on('message:send', (payload: unknown, ack?: (result: unknown) => void) => {
        const fail = (error: string) => ack?.({ ok: false, error });
        if (!payload || typeof payload !== 'object')
            return fail('Invalid message.');
        const data = payload as {
            recipientId?: unknown;
            body?: unknown;
        };
        const recipientId = Number(data.recipientId);
        if (!Number.isInteger(recipientId) || recipientId < 1 || recipientId === user.id)
            return fail('Choose a valid recipient.');
        if (typeof data.body !== 'string' || !data.body.trim() || data.body.length > 2000)
            return fail('Message must be 1–2000 characters.');
        const recipient = db.prepare('SELECT id FROM users WHERE id = ?').get(recipientId);
        if (!recipient)
            return fail('User not found.');
        const body = data.body.trim();
        const result = db.prepare('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)').run(user.id, recipientId, body);
        const message = {
            id: Number(result.lastInsertRowid), senderId: user.id, recipientId,
            body, createdAt: new Date().toISOString(), readAt: null, senderUsername: user.username
        };
        io.to(`user:${user.id}`).to(`user:${recipientId}`).emit('message:new', message);
        io.to(`user:${recipientId}`).emit('unread:update', { fromUserId: user.id });
        ack?.({ ok: true, message });
    });
});
server.listen(PORT, () => console.log(`Stychat API listening on http://localhost:${PORT}`));
