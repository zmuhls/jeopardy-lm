import jwt from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';

const JWT_SECRET = process.env.JWT_SECRET || 'jeopardy-lm-dev-secret-change-in-production';
const COOKIE_NAME = 'jeopardy_session';

export interface JwtPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextApiResponse, token: string) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`,
  ]);
}

export function clearAuthCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  ]);
}

export function getAuthUser(req: NextApiRequest): JwtPayload | null {
  const cookie = req.cookies[COOKIE_NAME];
  if (!cookie) return null;
  return verifyToken(cookie);
}

/** Shared validation used by both API and seed script */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUsername(username: string): string | null {
  if (username.length < 2 || username.length > 32) return 'Username must be 2–32 characters';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username may only contain letters, numbers, _ and -';
  return null;
}
