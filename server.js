import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const KEY = process.env.INBOX_KEY || 'dev';
const DATA = path.resolve('data/contacts.json');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public', { etag: false, maxAge: 0, setHeaders: function (res) { res.setHeader('Cache-Control', 'no-store'); } }));

const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

async function readAll() {
  try { return JSON.parse(await fs.readFile(DATA, 'utf8')); } catch { return []; }
}
async function writeAll(rows) {
  await fs.mkdir(path.dirname(DATA), { recursive: true });
  await fs.writeFile(DATA, JSON.stringify(rows, null, 2));
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/contacts', async (req, res) => {
  const { session, contacts, meta } = req.body || {};
  if (!Array.isArray(contacts) || !contacts.length) return res.json({ ok: true, stored: 0 });

  const rows = await readAll();
  const at = new Date().toISOString();
  let stored = 0;

  for (const c of contacts.slice(0, 2000)) {
    const name = (c.name && c.name[0]) || '';
    const tel = (c.tel && c.tel[0]) || '';
    const email = (c.email && c.email[0]) || '';
    if (!name && !tel && !email) continue;
    if (tel && rows.some(r => r.session === session && r.tel === tel)) continue;
    rows.push({ at, session, name, tel, email, ua: (meta && meta.ua) || '', ref: (meta && meta.ref) || '' });
    stored++;
  }

  await writeAll(rows);
  res.json({ ok: true, stored });
});

app.get('/api/contacts', async (req, res) => {
  if (req.query.key !== KEY) return res.status(401).json({ error: 'add ?key=' + KEY });
  res.json(await readAll());
});

app.get('/inbox', async (req, res) => {
  if (req.query.key !== KEY) {
    return res.status(401).type('html').send('<p style="font-family:system-ui">Add ?key=' + esc(KEY) + '</p>');
  }
  const rows = await readAll();
  const sessions = new Set(rows.map(r => r.session)).size;
  const body = rows.slice().reverse().map(r =>
    `<tr><td>${esc(r.name) || '<i>—</i>'}</td><td>${esc(r.tel)}</td><td>${esc(r.email)}</td><td class="m">${esc(r.at)}</td><td class="m">${esc((r.session || '').slice(0, 8))}</td></tr>`
  ).join('');

  res.type('html').send(`<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inbox</title><style>
body{font-family:system-ui,sans-serif;margin:0;padding:20px;color:#1a1a1a}
h1{font-size:20px;margin:0 0 4px}.s{color:#777;font-size:13px;margin-bottom:16px}
table{border-collapse:collapse;width:100%;font-size:14px}
td,th{border-bottom:1px solid #eee;padding:8px 6px;text-align:left}
th{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em}
.m{color:#999;font-size:12px;white-space:nowrap}
</style><h1>${rows.length} contacts</h1><div class="s">${sessions} sessions</div>
<table><tr><th>Name</th><th>Phone</th><th>Email</th><th>When</th><th>Session</th></tr>${body}</table>`);
});

app.listen(PORT, () => console.log('inbox: http://localhost:' + PORT + '/inbox?key=' + KEY));
