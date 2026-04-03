import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../lib/db';
import { getAuthUser } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const db = getDb();
  const board = db
    .prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?')
    .get(id, user.userId) as
    | { id: number; user_id: number; name: string; board_data: string; created_at: string; updated_at: string }
    | undefined;

  if (!board) return res.status(404).json({ error: 'Board not found' });

  if (req.method === 'GET') {
    return res.status(200).json({
      ...board,
      board_data: JSON.parse(board.board_data),
    });
  }

  if (req.method === 'PUT') {
    const { name, board_data } = req.body as { name?: string; board_data?: unknown };
    const newName = name ?? board.name;
    const newData = board_data ? JSON.stringify(board_data) : board.board_data;
    db.prepare(
      "UPDATE boards SET name = ?, board_data = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newName, newData, id);
    return res.status(200).json({ id, name: newName });
  }

  if (req.method === 'DELETE') {
    db.prepare('DELETE FROM boards WHERE id = ?').run(id);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
