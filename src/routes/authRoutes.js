import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';
import { hashPassword, signAccessToken, verifyPassword } from '../services/authService.js';
import { Roles, requireAuth, requireRole } from '../middleware/auth.js';

export const authRoutes = express.Router();

authRoutes.post(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const existing = await User.countDocuments();
    if (existing > 0) return res.status(403).json({ error: 'Bootstrap disabled' });

    const Body = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(10),
    });
    const body = Body.parse(req.body);

    const passwordHash = await hashPassword(body.password);
    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: Roles.SUPER_ADMIN,
    });

    const token = signAccessToken(user);
    res.json({ token, user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  })
);

authRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const Body = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const body = Body.parse(req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signAccessToken(user);
    res.json({ token, user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  })
);

authRoutes.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.sub).select('_id name email role caregiverProfile').lean();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role, caregiverProfile: user.caregiverProfile } });
  })
);

authRoutes.post(
  '/users',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const Body = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(10),
      role: z.enum(Object.values(Roles)),
      caregiverProfile: z
        .object({
          address: z.string().optional().default(''),
          contact: z.string().optional().default(''),
        })
        .optional(),
    });
    const body = Body.parse(req.body);

    const passwordHash = await hashPassword(body.password);
    const created = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
      role: body.role,
      caregiverProfile: body.caregiverProfile,
    });

    res.status(201).json({
      user: { id: String(created._id), name: created.name, email: created.email, role: created.role, caregiverProfile: created.caregiverProfile },
    });
  })
);

authRoutes.get(
  '/users',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN]),
  asyncHandler(async (req, res) => {
    const users = await User.find().select('_id name email role caregiverProfile').sort({ createdAt: -1 }).lean();
    res.json({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        caregiverProfile: u.caregiverProfile,
      })),
    });
  })
);

authRoutes.get(
  '/users/search',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '').trim();

    const regex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const query = {
      ...(role ? { role } : {}),
      ...(regex ? { $or: [{ name: regex }, { email: regex }] } : {}),
    };

    const users = await User.find(query).select('_id name email role caregiverProfile').limit(20).lean();
    res.json({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        caregiverProfile: u.caregiverProfile,
      })),
    });
  })
);

