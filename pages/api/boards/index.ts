import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../lib/db';
import { getAuthUser } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const db = getDb();

  if (req.method === 'GET') {
    const boards = db
      .prepare(
        'SELECT id, name, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC'
      )
      .all(user.userId);
    return res.status(200).json(boards);
  }

  if (req.method === 'POST') {
    const { name, board_data } = req.body as { name?: string; board_data?: unknown };
    if (!name || !board_data) {
      return res.status(400).json({ error: 'name and board_data required' });
    }
    const dataStr = JSON.stringify(board_data);
    const result = db
      .prepare(
        'INSERT INTO boards (user_id, name, board_data) VALUES (?, ?, ?)'
      )
      .run(user.userId, name, dataStr);
    return res.status(201).json({ id: result.lastInsertRowid, name });
  }

  res.status(405).end();
}
