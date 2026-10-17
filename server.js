require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'portfolio';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- Validation rules per table (also whitelists column names) ---------- */
const SECTIONS = {
  profile: { image: true, fields: {
    full_name: { req: 1, max: 120 }, title: { req: 1, max: 150 },
    email: { req: 1, max: 150, type: 'email' }, phone: { max: 40 },
    location: { max: 120 }, summary: { max: 2000 },
    linkedin: { max: 255, type: 'url' }, github: { max: 255, type: 'url' } } },
  skills: { order: 'category, id', fields: {
    name: { req: 1, max: 80 }, category: { max: 80 }, level: { type: 'level' } } },
  education: { order: 'id DESC', fields: {
    degree: { req: 1, max: 150 }, institution: { req: 1, max: 150 },
    start_year: { max: 10 }, end_year: { max: 10 }, description: { max: 1500 } } },
  experience: { order: 'id DESC', fields: {
    role: { req: 1, max: 150 }, company: { req: 1, max: 150 },
    start_date: { max: 20 }, end_date: { max: 20 }, description: { max: 2000 } } },
  projects: { image: true, order: 'id DESC', fields: {
    title: { req: 1, max: 150 }, description: { max: 2000 }, tech_stack: { max: 255 },
    project_url: { max: 255, type: 'url' }, repo_url: { max: 255, type: 'url' } } },
};

function clean(spec, body) {
  const out = {}, errors = {};
  for (const [key, rule] of Object.entries(spec.fields)) {
    const v = String(body[key] ?? '').trim();
    if (rule.req && !v) { errors[key] = 'This field is required'; continue; }
    if (v.length > (rule.max || 255)) { errors[key] = `Use at most ${rule.max} characters`; continue; }
    if (rule.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { errors[key] = 'Enter a valid email address'; continue; }
    if (rule.type === 'url' && v && !/^https?:\/\/\S+$/i.test(v)) { errors[key] = 'Start the link with http:// or https://'; continue; }
    if (rule.type === 'level') {
      if (v === '') { out[key] = null; continue; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100) { errors[key] = 'Enter a whole number from 0 to 100'; continue; }
      out[key] = n; continue;
    }
    out[key] = v || null;
  }
  return { out, errors };
}

/* ---------- Image upload ---------- */
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Upload a JPG, PNG or WebP image'), { status: 400 })),
});
const removeFile = (p) => { if (p) fs.unlink(path.join(__dirname, p), () => {}); };

/* ---------- App ---------- */
const app = express();
let pool;
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Everything the page needs in one request
app.get('/api/portfolio', wrap(async (req, res) => {
  const [[profile]] = await pool.query('SELECT * FROM profile WHERE id = 1');
  const data = { profile: profile || null };
  for (const t of ['skills', 'education', 'experience', 'projects']) {
    [data[t]] = await pool.query(`SELECT * FROM ?? ORDER BY ${SECTIONS[t].order}`, [t]);
  }
  res.json(data);
}));

// Create or update the single profile row
app.put('/api/profile', upload.single('image'), wrap(async (req, res) => {
  const { out, errors } = clean(SECTIONS.profile, req.body);
  if (Object.keys(errors).length) { removeFile(req.file && `uploads/${req.file.filename}`); return res.status(400).json({ errors }); }
  const [[old]] = await pool.query('SELECT image FROM profile WHERE id = 1');
  if (req.file) out.image = `/uploads/${req.file.filename}`;
  if (old) {
    await pool.query('UPDATE profile SET ? WHERE id = 1', [out]);
    if (req.file) removeFile(old.image);
  } else {
    await pool.query('INSERT INTO profile SET ?', [{ id: 1, ...out }]);
  }
  res.json({ ok: true });
}));

// Delete everything and start over
app.delete('/api/reset', wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT image FROM profile WHERE id = 1');
  const [projs] = await pool.query('SELECT image FROM projects');
  for (const t of ['skills', 'education', 'experience', 'projects', 'profile']) {
    await pool.query('TRUNCATE TABLE ??', [t]);
  }
  if (p) removeFile(p.image);
  projs.forEach((r) => removeFile(r.image));
  res.json({ ok: true });
}));

// Generic CRUD for skills, education, experience, projects
app.param('section', (req, res, next, name) =>
  SECTIONS[name] && name !== 'profile' ? next() : res.status(404).json({ error: 'Unknown section' }));

app.post('/api/:section', upload.single('image'), wrap(async (req, res) => {
  const t = req.params.section, spec = SECTIONS[t];
  const { out, errors } = clean(spec, req.body);
  if (Object.keys(errors).length) { removeFile(req.file && `uploads/${req.file.filename}`); return res.status(400).json({ errors }); }
  if (spec.image && req.file) out.image = `/uploads/${req.file.filename}`;
  const [r] = await pool.query('INSERT INTO ?? SET ?', [t, out]);
  res.status(201).json({ id: r.insertId });
}));

app.put('/api/:section/:id', upload.single('image'), wrap(async (req, res) => {
  const t = req.params.section, spec = SECTIONS[t];
  const { out, errors } = clean(spec, req.body);
  if (Object.keys(errors).length) { removeFile(req.file && `uploads/${req.file.filename}`); return res.status(400).json({ errors }); }
  const [[old]] = await pool.query('SELECT * FROM ?? WHERE id = ?', [t, req.params.id]);
  if (!old) { removeFile(req.file && `uploads/${req.file.filename}`); return res.status(404).json({ error: 'Entry not found' }); }
  if (spec.image && req.file) out.image = `/uploads/${req.file.filename}`;
  await pool.query('UPDATE ?? SET ? WHERE id = ?', [t, out, req.params.id]);
  if (spec.image && req.file) removeFile(old.image);
  res.json({ ok: true });
}));

app.delete('/api/:section/:id', wrap(async (req, res) => {
  const t = req.params.section;
  const [[old]] = await pool.query('SELECT * FROM ?? WHERE id = ?', [t, req.params.id]);
  if (!old) return res.status(404).json({ error: 'Entry not found' });
  await pool.query('DELETE FROM ?? WHERE id = ?', [t, req.params.id]);
  removeFile(old.image);
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ errors: { image: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 2 MB' : err.message } });
  }
  if (err.status === 400) return res.status(400).json({ errors: { image: err.message } });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

/* ---------- Start: create database + tables if missing ---------- */
(async () => {
  const boot = await mysql.createConnection({ ...DB, multipleStatements: true });
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4`);
  await boot.query(`USE \`${DB_NAME}\`;\n` + fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await boot.end();
  pool = mysql.createPool({ ...DB, database: DB_NAME, waitForConnections: true, connectionLimit: 10 });
  app.listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT}`));
})().catch((e) => { console.error('Could not start. Check your MySQL settings in .env\n', e.message); process.exit(1); });
