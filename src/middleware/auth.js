import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

export const Roles = /** @type {const} */ ({
  CAREGIVER: 'Caregiver',
  CARE_TEAM_LEADER: 'Care Team Leader',
  HOME_CARE_MANAGER: 'Home Care Manager',
  SUPER_ADMIN: 'Super Admin',
  FAMILY_MEMBER: 'Family Member',
});

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireRole(allowedRoles) {
  return function roleGuard(req, res, next) {
    const role = req.auth?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowedRoles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

export async function attachUser(req, res, next) {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await User.findById(userId).lean();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  return next();
}

