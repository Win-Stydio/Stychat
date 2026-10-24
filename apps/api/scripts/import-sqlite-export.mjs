import fs from 'node:fs';
import pg from 'pg';
const file = process.argv[2];
if (!file || !process.env.DATABASE_URL) {
  console.error('Usage: set DATABASE_URL first, then node apps/api/scripts/import-sqlite-export.mjs <export.json>');
  process.exit(2);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const tables = ['users','messages','chat_groups','group_members','group_messages'];
for (const t of tables) if (!Array.isArray(data[t])) throw new Error(`Missing array: ${t}`);
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'||process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}});
const c = await pool.connect();
try {
  for (const t of tables) {
    const q = await c.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    if (q.rows[0].n !== 0) throw new Error(`Table ${t} is not empty. Import cancelled to avoid duplicates.`);
  }
  await c.query('BEGIN');
  for (const r of data.users) await c.query('INSERT INTO users(id,username,password_hash,display_name,status,avatar_emoji,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[r.id,r.username,r.password_hash,r.display_name??'',r.status??'Доступен для общения',r.avatar_emoji??'🙂',r.created_at??new Date().toISOString()]);
  for (const r of data.chat_groups) await c.query('INSERT INTO chat_groups(id,name,description,owner_id,created_at) VALUES($1,$2,$3,$4,$5)',[r.id,r.name,r.description??'',r.owner_id,r.created_at??new Date().toISOString()]);
  for (const r of data.group_members) await c.query('INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES($1,$2,$3,$4)',[r.group_id,r.user_id,r.role??'member',r.joined_at??new Date().toISOString()]);
  for (const r of data.messages) await c.query('INSERT INTO messages(id,sender_id,recipient_id,body,created_at,read_at) VALUES($1,$2,$3,$4,$5,$6)',[r.id,r.sender_id,r.recipient_id,r.body,r.created_at??new Date().toISOString(),r.read_at??null]);
  for (const r of data.group_messages) await c.query('INSERT INTO group_messages(id,group_id,sender_id,body,created_at) VALUES($1,$2,$3,$4,$5)',[r.id,r.group_id,r.sender_id,r.body,r.created_at??new Date().toISOString()]);
  for (const t of ['users','messages','chat_groups','group_messages']) await c.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${t}),1),1), EXISTS(SELECT 1 FROM ${t}))`);
  await c.query('COMMIT');
  for (const t of tables) console.log(`${t}: ${(await c.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n}`);
  console.log('Import completed.');
} catch(e) { await c.query('ROLLBACK').catch(()=>{}); console.error('Import rolled back:',e); process.exitCode=1; }
finally { c.release(); await pool.end(); }
