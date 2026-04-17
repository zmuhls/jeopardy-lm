import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { getDb } from '../../../lib/db';
import { signToken, setAuthCookie } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const db = getDb();
  // Accept username or email
  const user = db
    .prepare('SELECT id, username, password_hash, is_admin FROM users WHERE username = ? OR email = ?')
    .get(login, login.toLowerCase()) as
    | { id: number; username: string; password_hash: string; is_admin: number }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isAdmin = user.is_admin === 1;
  const token = signToken({ userId: user.id, username: user.username, isAdmin });
  setAuthCookie(res, token);
  res.status(200).json({ userId: user.id, username: user.username, isAdmin });
}
