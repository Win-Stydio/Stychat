import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

const { Pool, types } = pg;
types.setTypeParser(20, (v: string) => Number(v));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' || process.env.DATABASE_URL?.includes('localhost')
    ? false : { rejectUnauthorized: false },
  max: 10, connectionTimeoutMillis: 10000,
});
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || '';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

type AuthUser = { id: number; username: string };
type PublicUser = AuthUser & { displayName: string; status: string; avatarEmoji: string };
type AuthedRequest = Request & { user?: AuthUser };
type DbUser = { id: number; username: string; display_name?: string; status?: string; avatar_emoji?: string };
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN, methods: ['GET','POST','PATCH'] } });
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '7d' }));

function tokenFor(user: AuthUser) { return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' }); }
function readToken(token: string): AuthUser {
  const d = jwt.verify(token, JWT_SECRET) as AuthUser;
  if (typeof d.id !== 'number' || typeof d.username !== 'string') throw new Error('Invalid token');
  return { id: d.id, username: d.username };
}
function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in.' });
  try { req.user = readToken(h.slice(7)); next(); }
  catch { return res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
}
function safeUser(r: DbUser): PublicUser {
  return { id: Number(r.id), username: r.username, displayName: r.display_name || r.username,
    status: r.status || 'Доступен для общения', avatarEmoji: r.avatar_emoji || '🙂' };
}
function idOf(v: unknown): number | null {
  const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function errCode(e: unknown) { return (e as { code?: string })?.code; }

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, app: 'Stychat API', database: 'connected' }); }
  catch { res.status(503).json({ ok: false, app: 'Stychat API', database: 'unavailable' }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: 'Username must be 3–20 characters: letters, numbers, underscore.' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query('INSERT INTO users(username,password_hash,display_name) VALUES($1,$2,$1) RETURNING id,username,display_name,status,avatar_emoji', [username, hash]);
    const user = safeUser(r.rows[0]);
    return res.status(201).json({ token: tokenFor({ id: user.id, username: user.username }), user });
  } catch (e) {
    if (errCode(e) === '23505') return res.status(409).json({ error: 'That username is already taken.' });
    console.error(e); return res.status(500).json({ error: 'Could not create account.' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Enter your username and password.' });
  const r = await pool.query('SELECT id,username,password_hash,display_name,status,avatar_emoji FROM users WHERE LOWER(username)=LOWER($1)', [username]);
  const row = r.rows[0] as (DbUser & { password_hash: string }) | undefined;
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ error: 'Incorrect username or password.' });
  const user = safeUser(row);
  res.json({ token: tokenFor({ id: user.id, username: user.username }), user });
});
app.get('/api/profile', auth, async (req: AuthedRequest, res) => {
  const r = await pool.query('SELECT id,username,display_name,status,avatar_emoji FROM users WHERE id=$1', [req.user!.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Account not found.' });
  res.json({ user: safeUser(r.rows[0]) });
});
app.patch('/api/profile', auth, async (req: AuthedRequest, res) => {
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
  const avatarEmoji = typeof req.body?.avatarEmoji === 'string' ? req.body.avatarEmoji : '🙂';
  const avatars = ['🙂','😀','😎','🥹','😍','🤓','😴','🤠','🦊','🐱','🐼','🐸','🐧','🦄','🐙','🐻','🌻','🍀','🍓','🌈','⭐','🚀','🎧','💚'];
  if (!avatars.includes(avatarEmoji)) return res.status(400).json({ error: 'Выбери смайлик из списка.' });
  if (displayName.length < 1 || displayName.length > 32) return res.status(400).json({ error: 'Display name must be 1–32 characters.' });
  if (status.length > 80) return res.status(400).json({ error: 'Status must be at most 80 characters.' });
  const r = await pool.query('UPDATE users SET display_name=$1,status=$2,avatar_emoji=$3 WHERE id=$4 RETURNING id,username,display_name,status,avatar_emoji',
    [displayName, status || 'Доступен для общения', avatarEmoji, req.user!.id]);
  const user = safeUser(r.rows[0]); io.emit('profile:updated', user); res.json({ user });
});
app.post('/api/media', auth, (req: AuthedRequest, res) => {
  const { name, mimeType, data } = req.body ?? {};
  const allowed = new Set(['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','audio/webm','application/pdf']);
  if (typeof mimeType !== 'string' || !allowed.has(mimeType) || typeof data !== 'string') return res.status(400).json({ error: 'Поддерживаются изображения, видео, аудио и PDF.' });
  const match = data.match(/^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== mimeType) return res.status(400).json({ error: 'Файл имеет неверный формат.' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 8*1024*1024) return res.status(413).json({ error: 'Максимальный размер файла: 8 МБ.' });
  const ext: Record<string,string> = {'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp','video/mp4':'.mp4','video/webm':'.webm','audio/mpeg':'.mp3','audio/ogg':'.ogg','audio/wav':'.wav','audio/webm':'.webm','application/pdf':'.pdf'};
  const filename = `${randomUUID()}${ext[mimeType]}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer, { flag: 'wx' });
  res.status(201).json({ url: `/uploads/${filename}`, name: typeof name === 'string' ? name.slice(0,160).replace(/[\r\n]/g,'') : filename, mimeType, size: buffer.length });
});
app.get('/api/users', auth, async (req: AuthedRequest, res) => {
  const r = await pool.query('SELECT id,username,display_name,status,avatar_emoji FROM users WHERE id<>$1 ORDER BY LOWER(username)', [req.user!.id]);
  res.json({ users: r.rows.map(safeUser) });
});
app.get('/api/groups', auth, async (req: AuthedRequest, res) => {
  const r = await pool.query(`SELECT g.id,g.name,g.description,g.owner_id AS "ownerId",
    (SELECT COUNT(*)::int FROM group_members x WHERE x.group_id=g.id) AS "memberCount"
    FROM chat_groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user_id=$1 ORDER BY g.id DESC`, [req.user!.id]);
  res.json({ groups: r.rows });
});
app.post('/api/groups', auth, async (req: AuthedRequest, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0,48) : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0,180) : '';
  const ids = Array.isArray(req.body?.memberIds) ? [...new Set(req.body.memberIds.map(Number).filter((n: number) => Number.isSafeInteger(n) && n>0 && n!==req.user!.id))] : [];
  if (name.length < 2) return res.status(400).json({ error: 'Название группы должно содержать минимум 2 символа.' });
  const c = await pool.connect(); let groupId = 0;
  try {
    await c.query('BEGIN');
    groupId = Number((await c.query('INSERT INTO chat_groups(name,description,owner_id) VALUES($1,$2,$3) RETURNING id',[name,description,req.user!.id])).rows[0].id);
    await c.query('INSERT INTO group_members(group_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[groupId,req.user!.id,'owner']);
    for (const id of ids) {
      const exists = await c.query('SELECT 1 FROM users WHERE id=$1',[id]);
      if (exists.rowCount) await c.query('INSERT INTO group_members(group_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[groupId,id,'member']);
    }
    await c.query('COMMIT');
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  const r = await pool.query(`SELECT g.id,g.name,g.description,g.owner_id AS "ownerId",(SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id=g.id) AS "memberCount" FROM chat_groups g WHERE g.id=$1`,[groupId]);
  const group = r.rows[0]; const members = await pool.query('SELECT user_id AS "userId" FROM group_members WHERE group_id=$1',[groupId]);
  for (const m of members.rows) io.to(`user:${m.userId}`).emit('groups:updated',group);
  res.status(201).json({ group });
});
app.get('/api/groups/:groupId/messages', auth, async (req: AuthedRequest, res) => {
  const gid = idOf(req.params.groupId); if (!gid) return res.status(400).json({ error: 'Некорректная группа.' });
  if (!(await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[gid,req.user!.id])).rowCount) return res.status(403).json({ error: 'У вас нет доступа к этой группе.' });
  const n = Number(req.query.limit ?? 50), limit = Number.isInteger(n) ? Math.max(1,Math.min(n,100)) : 50;
  const before = req.query.beforeId === undefined ? null : idOf(req.query.beforeId);
  if (req.query.beforeId !== undefined && !before) return res.status(400).json({ error: 'Некорректная позиция истории.' });
  const params: unknown[] = [gid]; let cursor = '';
  if (before) { params.push(before); cursor = ` AND gm.id<$${params.length}`; }
  params.push(limit+1);
  const r = await pool.query(`SELECT gm.id,gm.group_id AS "groupId",gm.sender_id AS "senderId",gm.body,gm.created_at AS "createdAt",u.username AS "senderUsername",u.display_name AS "senderDisplayName" FROM group_messages gm JOIN users u ON u.id=gm.sender_id WHERE gm.group_id=$1${cursor} ORDER BY gm.id DESC LIMIT $${params.length}`,params);
  res.json({ messages:r.rows.slice(0,limit).reverse(), hasMore:r.rows.length>limit });
});
app.get('/api/groups/:groupId/members', auth, async (req: AuthedRequest, res) => {
  const gid = idOf(req.params.groupId); if (!gid) return res.status(400).json({ error: 'Некорректная группа.' });
  if (!(await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[gid,req.user!.id])).rowCount) return res.status(403).json({ error: 'У вас нет доступа к этой группе.' });
  const r = await pool.query(`SELECT u.id,u.username,u.display_name AS "displayName",u.status,gm.role FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 ORDER BY gm.role DESC,u.username`,[gid]);
  res.json({ members:r.rows });
});
app.get('/api/unread', auth, async (req: AuthedRequest, res) => {
  const r = await pool.query('SELECT sender_id AS "userId",COUNT(*)::int AS count FROM messages WHERE recipient_id=$1 AND read_at IS NULL GROUP BY sender_id',[req.user!.id]);
  res.json({ unread:Object.fromEntries(r.rows.map(x=>[x.userId,x.count])) });
});
app.get('/api/search', auth, async (req: AuthedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0,100) : '';
  if (q.length<2) return res.json({ messages:[] });
  const r = await pool.query(`SELECT m.id,m.sender_id AS "senderId",m.recipient_id AS "recipientId",CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END AS "otherUserId",m.body,m.created_at AS "createdAt",m.read_at AS "readAt",u.username AS "senderUsername" FROM messages m JOIN users u ON u.id=m.sender_id WHERE (m.sender_id=$1 OR m.recipient_id=$1) AND m.body ILIKE $2 ORDER BY m.id DESC LIMIT 100`,[req.user!.id,`%${q}%`]);
  res.json({ messages:r.rows });
});
app.get('/api/messages/:userId', auth, async (req: AuthedRequest, res) => {
  const rid=idOf(req.params.userId); if (!rid || rid===req.user!.id) return res.status(400).json({ error:'Invalid conversation.' });
  const n=Number(req.query.limit??50), limit=Number.isInteger(n)?Math.max(1,Math.min(n,100)):50;
  const before=req.query.beforeId===undefined?null:idOf(req.query.beforeId);
  if(req.query.beforeId!==undefined&&!before) return res.status(400).json({error:'Invalid history cursor.'});
  if(!before) { await pool.query('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL',[rid,req.user!.id]); io.to(`user:${rid}`).emit('messages:read',{byUserId:req.user!.id,conversationUserId:rid}); }
  const params: unknown[]=[req.user!.id,rid,rid,req.user!.id]; let cursor='';
  if(before){params.push(before);cursor=` AND m.id<$${params.length}`;} params.push(limit+1);
  const r=await pool.query(`SELECT m.id,m.sender_id AS "senderId",m.recipient_id AS "recipientId",m.body,m.created_at AS "createdAt",m.read_at AS "readAt",u.username AS "senderUsername" FROM messages m JOIN users u ON u.id=m.sender_id WHERE ((m.sender_id=$1 AND m.recipient_id=$2) OR (m.sender_id=$3 AND m.recipient_id=$4))${cursor} ORDER BY m.id DESC LIMIT $${params.length}`,params);
  res.json({messages:r.rows.slice(0,limit).reverse(),hasMore:r.rows.length>limit});
});
app.use('/api', (_req,res)=>res.status(404).json({error:'API endpoint not found.'}));

io.use((socket,next)=>{const t=socket.handshake.auth?.token;if(typeof t!=='string')return next(new Error('Authentication required'));try{socket.data.user=readToken(t);next();}catch{return next(new Error('Invalid or expired session'));}});
io.on('connection',(socket)=>{
  const user=socket.data.user as AuthUser; socket.join(`user:${user.id}`);
  socket.on('typing:start',(v:unknown)=>{const rid=idOf(v);if(rid&&rid!==user.id)io.to(`user:${rid}`).emit('typing:update',{userId:user.id,username:user.username,typing:true});});
  socket.on('typing:stop',(v:unknown)=>{const rid=idOf(v);if(rid&&rid!==user.id)io.to(`user:${rid}`).emit('typing:update',{userId:user.id,username:user.username,typing:false});});
  socket.on('group:message:send',async(payload:unknown,ack?:(r:unknown)=>void)=>{
    const fail=(error:string)=>ack?.({ok:false,error});
    try {
      if(!payload||typeof payload!=='object')return fail('Некорректное сообщение.');
      const d=payload as {groupId?:unknown;body?:unknown}, gid=idOf(d.groupId);
      if(!gid)return fail('Выбери группу.');
      if(typeof d.body!=='string'||!d.body.trim()||d.body.length>2000)return fail('Сообщение должно содержать от 1 до 2000 символов.');
      if(!(await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[gid,user.id])).rowCount)return fail('У тебя нет доступа к этой группе.');
      const ins=await pool.query('INSERT INTO group_messages(group_id,sender_id,body) VALUES($1,$2,$3) RETURNING id',[gid,user.id,d.body.trim()]);
      const r=await pool.query(`SELECT gm.id,gm.group_id AS "groupId",gm.sender_id AS "senderId",gm.body,gm.created_at AS "createdAt",u.username AS "senderUsername",u.display_name AS "senderDisplayName" FROM group_messages gm JOIN users u ON u.id=gm.sender_id WHERE gm.id=$1`,[ins.rows[0].id]);
      const members=await pool.query('SELECT user_id AS "userId" FROM group_members WHERE group_id=$1',[gid]);
      for(const m of members.rows)io.to(`user:${m.userId}`).emit('group:message:new',r.rows[0]);
      ack?.({ok:true,message:r.rows[0]});
    } catch(e){console.error('Group message failed',e);fail('Не удалось отправить сообщение.');}
  });
  socket.on('message:send',async(payload:unknown,ack?:(r:unknown)=>void)=>{
    const fail=(error:string)=>ack?.({ok:false,error});
    try {
      if(!payload||typeof payload!=='object')return fail('Invalid message.');
      const d=payload as {recipientId?:unknown;body?:unknown}, rid=idOf(d.recipientId);
      if(!rid||rid===user.id)return fail('Choose a valid recipient.');
      if(typeof d.body!=='string'||!d.body.trim()||d.body.length>2000)return fail('Message must be 1–2000 characters.');
      if(!(await pool.query('SELECT id FROM users WHERE id=$1',[rid])).rowCount)return fail('User not found.');
      const body=d.body.trim();
      const ins=await pool.query('INSERT INTO messages(sender_id,recipient_id,body) VALUES($1,$2,$3) RETURNING id,created_at',[user.id,rid,body]);
      const m={id:Number(ins.rows[0].id),senderId:user.id,recipientId:rid,body,createdAt:ins.rows[0].created_at,readAt:null,senderUsername:user.username};
      io.to(`user:${user.id}`).to(`user:${rid}`).emit('message:new',m);
      io.to(`user:${rid}`).emit('unread:update',{fromUserId:user.id});
      ack?.({ok:true,message:m});
    } catch(e){console.error('Direct message failed',e);fail('Could not send message.');}
  });
});
async function start(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for PostgreSQL mode.');
  if(!JWT_SECRET)throw new Error('JWT_SECRET is required. Set it in your local .env and Render environment.');
  if(process.env.NODE_ENV==='production'&&JWT_SECRET==='development-only-change-this-secret')throw new Error('Unsafe JWT_SECRET in production.');
  await pool.query('SELECT 1');
  server.listen(PORT,()=>console.log(`Stychat PostgreSQL API listening on port ${PORT}`));
}
start().catch(e=>{console.error('API startup failed:',e);process.exit(1);});
