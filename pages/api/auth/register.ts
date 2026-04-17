import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { getDb } from '../../../lib/db';
import { signToken, setAuthCookie, validatePassword, validateEmail, validateUsername } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const db = getDb();

  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUsername) return res.status(409).json({ error: 'Username already taken' });

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email.toLowerCase(), hash);
  const userId = result.lastInsertRowid as number;

  const token = signToken({ userId, username, isAdmin: false });
  setAuthCookie(res, token);
  res.status(201).json({ userId, username, isAdmin: false });
}
