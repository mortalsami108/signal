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

app.get('/health', (req, res) => res.json({ ok: true, jobs: jobs.size }));

app.get('/start', async (req, res) => {
  const sid = crypto.randomUUID();
  const cfg = path.join(ROOT, sid);
  await fs.mkdir(cfg, { recursive: true });

  const job = { sid, uri: null, qr: null, state: 'waiting', contacts: [], error: null };
  jobs.set(sid, job);

  const proc = spawn('signal-cli', ['--config', cfg, 'link', '-n', 'web']);
  let buf = '';

  proc.stdout.on('data', async d => {
    buf += d.toString();
    const m = buf.match(/sgnl:\/\/linkdevice\?[^\s"'<>\]]+/);
    if (m && !job.uri) {
      job.uri = m[0];
      job.qr = await QRCode.toDataURL(job.uri, { margin: 1, width: 320 });
      job.state = 'ready';
      console.log(sid, 'uri ready');
    }
  });
  proc.stderr.on('data', d => console.log(sid, '[cli]', d.toString().trim().slice(0, 200)));

  proc.on('exit', async code => {
    console.log(sid, 'link exited', code);
    if (code !== 0) { job.state = 'failed'; job.error = 'linking failed, code ' + code; return; }
    job.state = 'linked';
    try {
      await run(['--config', cfg, 'receive'], 90000);
      let out = '[]';
      try { out = await run(['--config', cfg, 'listContacts', '--json'], 60000); } catch {}
      const list = JSON.parse(out || '[]');
      job.contacts = Array.isArray(list) ? list.slice(0, 300) : [];
      job.state = 'done';
      console.log(sid, 'contacts', job.contacts.length);
    } catch (e) { job.error = e.message; job.state = 'error'; }
  });

  res.json({ sid });
});

app.get('/state/:sid', (req, res) => {
  const j = jobs.get(req.params.sid);
  if (!j) return res.status(404).json({ error: 'unknown' });
  res.json({ state: j.state, uri: j.uri, qr: j.qr, error: j.error, contacts: j.state === 'done' ? j.contacts : [] });
});

app.listen(PORT, () => console.log('listening on ' + PORT));
