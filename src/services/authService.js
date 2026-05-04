import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(user) {
  const payload = {
    sub: String(user._id),
    role: user.role,
    name: user.name,
    email: user.email,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
}

