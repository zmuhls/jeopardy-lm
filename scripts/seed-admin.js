#!/usr/bin/env node
/**
 * seed-admin.js — Create or reset the admin account
 *
 * Usage:
 *   node scripts/seed-admin.js
 *   ADMIN_USERNAME=myadmin ADMIN_EMAIL=me@example.com ADMIN_PASSWORD=S3cret! node scripts/seed-admin.js
 *
 * Defaults (override via env vars):
 *   ADMIN_USERNAME = admin
 *   ADMIN_EMAIL    = admin@jeopardy-lm.local
 *   ADMIN_PASSWORD = Admin1234!
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'jeopardy.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure schema exists (mirrors lib/db.ts)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate if needed
const cols = db.pragma('table_info(users)').map(c => c.name);
if (!cols.includes('email'))    db.exec("ALTER TABLE users ADD COLUMN email TEXT UNIQUE COLLATE NOCASE;");
if (!cols.includes('is_admin')) db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;");

const username = process.env.ADMIN_USERNAME || 'admin';
const email    = (process.env.ADMIN_EMAIL    || 'admin@jeopardy-lm.local').toLowerCase();
const password = process.env.ADMIN_PASSWORD  || 'Admin1234!';

// Validate password meets policy
function validatePassword(pw) {
  if (pw.length < 8)          return 'at least 8 characters';
  if (!/[A-Z]/.test(pw))      return 'at least one uppercase letter';
  if (!/[0-9]/.test(pw))      return 'at least one number';
  return null;
}
const pwError = validatePassword(password);
if (pwError) {
  console.error(`\n✗ Password does not meet requirements: ${pwError}\n`);
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
  // Reset the existing admin's password and promote to admin
  db.prepare("UPDATE users SET password_hash = ?, email = ?, is_admin = 1 WHERE username = ?")
    .run(hash, email, username);
  console.log(`\n✓ Admin account updated`);
} else {
  db.prepare("INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, 1)")
    .run(username, email, hash);
  console.log(`\n✓ Admin account created`);
}

console.log(`  Username : ${username}`);
console.log(`  Email    : ${email}`);
console.log(`  Password : ${password}`);
console.log(`\n  ⚠  Change the default password before deploying to production.\n`);
