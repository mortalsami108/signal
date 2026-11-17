import express from 'express';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3001);
const ROOT = path.resolve('data/jobs');

const app = express();
app.use(express.static('public'));

const jobs = new Map();

function run(args, timeout) {
  return new Promise((resolve, reject) => {
    const p = spawn('signal-cli', args);
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    const t = setTimeout(() => { p.kill(); reject(new Error('timeout')); }, timeout);
    p.on('exit', c => { clearTimeout(t); c === 0 ? resolve(out) : reject(new Error(err || 'exit ' + c)); });
  });
}

async function begin(job) {
  const cfg = path.join(ROOT, job.sid);
  await fs.mkdir(cfg, { recursive: true });
  job.cfg = cfg;
  job.uri = null;
  job.qr = null;
  job.state = 'waiting';

  const proc = spawn('signal-cli', ['--config', cfg, 'link', '-n', 'web']);
  job.proc = proc;
  let buf = '';

  proc.stdout.on('data', async d => {
    buf += d.toString();
    const m = buf.match(/sgnl:\/\/linkdevice\?[^\s"'<>\]]+/);
    if (m && !job.uri) {
      job.uri = m[0];
      job.qr = await QRCode.toDataURL(job.uri, { margin: 1, width: 300 });
      job.state = 'ready';
      console.log(job.sid, 'uri ready');
    }
  });
  proc.stderr.on('data', d => console.log(job.sid, '[cli]', d.toString().trim().slice(0, 300)));

  proc.on('exit', async code => {
    console.log(job.sid, 'link exited', code);
    if (code !== 0) { job.state = 'failed'; job.error = 'link failed, code ' + code; return; }
    job.state = 'linked';
    try {
      await run(['--config', cfg, 'receive'], 90000);
      let out = '[]';
      try { out = await run(['--config', cfg, 'listContacts', '--json'], 60000); } catch (e) { console.log('list failed', e.message); }
      let list = [];
      try { list = JSON.parse(out); } catch {}
      job.contacts = Array.isArray(list) ? list.slice(0, 300) : [];
      job.state = 'done';
      console.log(job.sid, 'contacts', job.contacts.length);
    } catch (e) { job.error = e.message; job.state = 'error'; }
  });
}

app.get('/health', (req, res) => res.json({ ok: true, jobs: jobs.size }));

app.get('/start', async (req, res) => {
  const sid = crypto.randomUUID();
  const job = { sid, uri: null, qr: null, state: 'waiting', contacts: [], error: null };
  jobs.set(sid, job);
  await begin(job);
  res.json({ sid });
});

app.get('/retry/:sid', async (req, res) => {
  const job = jobs.get(req.params.sid);
  if (!job) return res.status(404).json({ error: 'unknown' });
  try { if (job.proc) job.proc.kill(); } catch {}
  await begin(job);
  res.json({ ok: true });
});

app.get('/state/:sid', (req, res) => {
  const j = jobs.get(req.params.sid);
  if (!j) return res.status(404).json({ error: 'unknown' });
  res.json({
    state: j.state,
    uri: j.uri,
    qr: j.qr,
    error: j.error,
    contacts: j.state === 'done'
      ? j.contacts.map(c => ({ name: c.name || c.profileName || '', number: c.number || c.aci || '' }))
      : []
  });
});

app.listen(PORT, () => console.log('listening on ' + PORT));
