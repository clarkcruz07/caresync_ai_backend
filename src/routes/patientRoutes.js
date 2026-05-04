import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { Roles, requireAuth, requireRole } from '../middleware/auth.js';

export const patientRoutes = express.Router();

function canViewPatient(role) {
  return [
    Roles.SUPER_ADMIN,
    Roles.HOME_CARE_MANAGER,
    Roles.CARE_TEAM_LEADER,
    Roles.CAREGIVER,
    Roles.FAMILY_MEMBER,
  ].includes(role);
}

patientRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!canViewPatient(req.auth.role)) return res.status(403).json({ error: 'Forbidden' });

    const role = req.auth.role;
    const userId = new mongoose.Types.ObjectId(req.auth.sub);

    const query =
      role === Roles.CAREGIVER
        ? { assignedCaregivers: userId }
        : role === Roles.FAMILY_MEMBER
          ? { familyMembers: userId }
          : {};

    const patients = await Patient.find(query).sort({ createdAt: -1 }).lean();
    res.json({
      patients: patients.map((p) => ({
        id: String(p._id),
        name: p.name,
        DOB: p.DOB,
        condition: p.condition,
        mobility: p.mobility,
        assignedCaregivers: (p.assignedCaregivers || []).map(String),
        familyMembers: (p.familyMembers || []).map(String),
        currentCarePlanId: p.currentCarePlanId ? String(p.currentCarePlanId) : null,
      })),
    });
  })
);

patientRoutes.post(
  '/',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const Body = z.object({
      name: z.string().min(1),
      DOB: z.coerce.date(),
      condition: z.string().min(1),
      mobility: z.string().min(1),
      assignedCaregiverIds: z.array(z.string()).optional().default([]),
      familyMemberIds: z.array(z.string()).optional().default([]),
    });
    const body = Body.parse(req.body);

    const patient = await Patient.create({
      name: body.name,
      DOB: body.DOB,
      condition: body.condition,
      mobility: body.mobility,
      assignedCaregivers: body.assignedCaregiverIds,
      familyMembers: body.familyMemberIds,
    });

    res.status(201).json({ patient: { id: String(patient._id) } });
  })
);

patientRoutes.get(
  '/caregivers/search',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const regex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const query = regex
      ? { role: Roles.CAREGIVER, $or: [{ name: regex }, { email: regex }] }
      : { role: Roles.CAREGIVER };

    const caregivers = await User.find(query).select('_id name email caregiverProfile').limit(20).lean();
    res.json({
      caregivers: caregivers.map((c) => ({
        id: String(c._id),
        name: c.name,
        email: c.email,
        caregiverProfile: c.caregiverProfile,
      })),
    });
  })
);

patientRoutes.patch(
  '/:id/assignments',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const Params = z.object({ id: z.string().min(1) });
    const Body = z.object({
      assignedCaregiverIds: z.array(z.string()).default([]),
      familyMemberIds: z.array(z.string()).default([]),
    });
    const { id } = Params.parse(req.params);
    const body = Body.parse(req.body);

    await Patient.updateOne(
      { _id: id },
      { $set: { assignedCaregivers: body.assignedCaregiverIds, familyMembers: body.familyMemberIds } }
    );
    res.json({ ok: true });
  })
);

