import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUser } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.status(200).json({ userId: user.userId, username: user.username, isAdmin: user.isAdmin });
}
