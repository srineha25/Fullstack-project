import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('conference.db');
const JWT_SECRET = 'super-secret-conference-key';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT DEFAULT 'user',
    affiliation TEXT,
    bio TEXT,
    profile_picture TEXT
  );

  CREATE TABLE IF NOT EXISTS conferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    date TEXT,
    location TEXT,
    status TEXT DEFAULT 'upcoming'
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conference_id INTEGER,
    user_id INTEGER,
    title TEXT,
    abstract TEXT,
    file_path TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(conference_id) REFERENCES conferences(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER,
    reviewer_id INTEGER,
    comments TEXT,
    score INTEGER,
    FOREIGN KEY(submission_id) REFERENCES submissions(id),
    FOREIGN KEY(reviewer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conference_id INTEGER,
    title TEXT,
    start_time TEXT,
    end_time TEXT,
    room TEXT,
    FOREIGN KEY(conference_id) REFERENCES conferences(id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    file_path TEXT,
    status TEXT DEFAULT 'pending',
    type TEXT, -- 'user_upload' or 'admin_upload'
    accepted INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed Admin if not exists
const adminExists = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(
    'admin@confmaster.com',
    hashedPassword,
    'System Admin',
    'admin'
  );

  // Add more example users
  const userPassword = bcrypt.hashSync('user123', 10);
  db.prepare('INSERT INTO users (email, password, name, role, affiliation, bio) VALUES (?, ?, ?, ?, ?, ?)').run(
    'user@example.com',
    userPassword,
    'John Doe',
    'user',
    'Stanford University',
    'PhD student focusing on Natural Language Processing and Large Language Models.'
  );

  db.prepare('INSERT INTO users (email, password, name, role, affiliation, bio) VALUES (?, ?, ?, ?, ?, ?)').run(
    'researcher@uni.edu',
    userPassword,
    'Dr. Sarah Smith',
    'user',
    'MIT Media Lab',
    'Senior researcher in Human-Computer Interaction and ubiquitous computing.'
  );

  db.prepare('INSERT INTO users (email, password, name, role, affiliation, bio) VALUES (?, ?, ?, ?, ?, ?)').run(
    'reviewer@science.org',
    userPassword,
    'Prof. Alan Turing',
    'admin',
    'University of Cambridge',
    'Expert in computational theory and artificial intelligence.'
  );
  
  // Seed some example data
  db.prepare('INSERT INTO conferences (title, description, date, location) VALUES (?, ?, ?, ?)').run(
    'International AI Conference 2026',
    'A premier conference on Artificial Intelligence and Machine Learning.',
    '2026-06-15',
    'San Francisco, CA'
  );
  
  db.prepare('INSERT INTO conferences (title, description, date, location) VALUES (?, ?, ?, ?)').run(
    'Global Sustainability Summit',
    'Focusing on renewable energy and green technologies.',
    '2026-09-20',
    'Berlin, Germany'
  );

  const confId = 1;
  db.prepare('INSERT INTO schedule (conference_id, title, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)').run(
    confId, 'Opening Keynote: The Future of AGI', '09:00', '10:30', 'Grand Ballroom'
  );
  db.prepare('INSERT INTO schedule (conference_id, title, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)').run(
    confId, 'Neural Architecture Search Workshop', '11:00', '12:30', 'Room 302'
  );
}

const app = express();
app.use(express.json());

// File Upload Setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};

// --- API Routes ---

// Auth
app.get('/api/auth/me', authenticate, (req: any, res) => {
  const user = db.prepare('SELECT id, email, name, role, affiliation, bio, profile_picture FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.patch('/api/profile', authenticate, upload.single('profile_picture'), (req: any, res) => {
  const { name, affiliation, bio } = req.body;
  const profile_picture = req.file ? req.file.filename : undefined;

  if (profile_picture) {
    db.prepare('UPDATE users SET name = ?, affiliation = ?, bio = ?, profile_picture = ? WHERE id = ?')
      .run(name, affiliation, bio, profile_picture, req.user.id);
  } else {
    db.prepare('UPDATE users SET name = ?, affiliation = ?, bio = ? WHERE id = ?')
      .run(name, affiliation, bio, req.user.id);
  }

  const updatedUser = db.prepare('SELECT id, email, name, role, affiliation, bio, profile_picture FROM users WHERE id = ?').get(req.user.id);
  res.json(updatedUser);
});

app.get('/api/users', authenticate, isAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, affiliation, bio, profile_picture FROM users').all();
  res.json(users);
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hashedPassword, name);
    const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'user', name }, JWT_SECRET);
    res.json({ token, user: { id: result.lastInsertRowid, email, name, role: 'user' } });
  } catch (e) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// Conferences
app.get('/api/conferences', (req, res) => {
  const conferences = db.prepare('SELECT * FROM conferences ORDER BY date ASC').all();
  res.json(conferences);
});

app.post('/api/conferences', authenticate, isAdmin, (req, res) => {
  const { title, description, date, location } = req.body;
  const result = db.prepare('INSERT INTO conferences (title, description, date, location) VALUES (?, ?, ?, ?)').run(title, description, date, location);
  res.json({ id: result.lastInsertRowid });
});

// Submissions
app.get('/api/submissions', authenticate, (req: any, res) => {
  let submissions;
  if (req.user.role === 'admin') {
    submissions = db.prepare(`
      SELECT s.*, u.name as author_name, c.title as conference_title,
      (SELECT GROUP_CONCAT(u2.name, ', ') 
       FROM reviews r 
       JOIN users u2 ON r.reviewer_id = u2.id 
       WHERE r.submission_id = s.id) as reviewers
      FROM submissions s 
      JOIN users u ON s.user_id = u.id 
      JOIN conferences c ON s.conference_id = c.id
    `).all();
  } else {
    submissions = db.prepare(`
      SELECT s.*, c.title as conference_title 
      FROM submissions s 
      JOIN conferences c ON s.conference_id = c.id
      WHERE s.user_id = ?
    `).all(req.user.id);
  }
  res.json(submissions);
});

app.post('/api/submissions/:id/assign', authenticate, isAdmin, (req, res) => {
  const { reviewer_id } = req.body;
  const submission_id = req.params.id;
  
  // Check if already assigned
  const existing = db.prepare('SELECT * FROM reviews WHERE submission_id = ? AND reviewer_id = ?').get(submission_id, reviewer_id);
  if (existing) return res.status(400).json({ error: 'Reviewer already assigned' });

  db.prepare('INSERT INTO reviews (submission_id, reviewer_id) VALUES (?, ?)').run(submission_id, reviewer_id);
  res.json({ success: true });
});

app.post('/api/submissions', authenticate, upload.single('file'), (req: any, res) => {
  const { conference_id, title, abstract } = req.body;
  const file_path = req.file ? req.file.filename : null;
  const result = db.prepare('INSERT INTO submissions (conference_id, user_id, title, abstract, file_path) VALUES (?, ?, ?, ?, ?)').run(
    conference_id, req.user.id, title, abstract, file_path
  );
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/submissions/:id/status', authenticate, isAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Reviews
app.get('/api/submissions/:id/reviews', authenticate, (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name 
    FROM reviews r 
    JOIN users u ON r.reviewer_id = u.id 
    WHERE r.submission_id = ?
  `).all(req.params.id);
  res.json(reviews);
});

app.post('/api/reviews', authenticate, isAdmin, (req: any, res) => {
  const { submission_id, comments, score } = req.body;
  db.prepare('INSERT INTO reviews (submission_id, reviewer_id, comments, score) VALUES (?, ?, ?, ?)').run(
    submission_id, req.user.id, comments, score
  );
  res.json({ success: true });
});

// Schedule
app.get('/api/conferences/:id/schedule', (req, res) => {
  const schedule = db.prepare('SELECT * FROM schedule WHERE conference_id = ? ORDER BY start_time ASC').all(req.params.id);
  res.json(schedule);
});

app.post('/api/schedule', authenticate, isAdmin, (req, res) => {
  const { conference_id, title, start_time, end_time, room } = req.body;
  db.prepare('INSERT INTO schedule (conference_id, title, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)').run(
    conference_id, title, start_time, end_time, room
  );
  res.json({ success: true });
});

// Documents
app.get('/api/documents', authenticate, (req: any, res) => {
  let docs;
  if (req.user.role === 'admin') {
    docs = db.prepare(`
      SELECT d.*, u.name as user_name 
      FROM documents d 
      JOIN users u ON d.user_id = u.id
    `).all();
  } else {
    docs = db.prepare('SELECT * FROM documents WHERE user_id = ?').all(req.user.id);
  }
  res.json(docs);
});

app.post('/api/documents', authenticate, upload.single('file'), (req: any, res) => {
  const { title, type, user_id } = req.body; // user_id is provided if admin is uploading for a specific user
  const targetUserId = req.user.role === 'admin' ? user_id : req.user.id;
  const docType = req.user.role === 'admin' ? 'admin_upload' : 'user_upload';
  const file_path = req.file ? req.file.filename : null;

  const result = db.prepare('INSERT INTO documents (user_id, title, file_path, type) VALUES (?, ?, ?, ?)').run(
    targetUserId, title, file_path, docType
  );
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/documents/:id/verify', authenticate, isAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.patch('/api/documents/:id/accept', authenticate, (req: any, res) => {
  db.prepare('UPDATE documents SET accepted = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Serve static files from uploads
app.use('/uploads', express.static(uploadDir));

// Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
