import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Roles, requireAuth, requireRole } from '../middleware/auth.js';
import { Patient } from '../models/Patient.js';
import { CareLog } from '../models/CareLog.js';

export const careLogRoutes = express.Router();

careLogRoutes.post(
  '/',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER, Roles.CAREGIVER]),
  asyncHandler(async (req, res) => {
    const Body = z.object({
      patientId: z.string().min(1),
      vitals: z
        .object({
          heartRate: z.number().optional(),
          systolicBP: z.number().optional(),
          diastolicBP: z.number().optional(),
          temperatureC: z.number().optional(),
          spo2: z.number().optional(),
        })
        .optional()
        .default({}),
      medsGiven: z
        .array(
          z.object({
            name: z.string().min(1),
            dose: z.string().optional().default(''),
            time: z.string().optional().default(''),
            notes: z.string().optional().default(''),
          })
        )
        .optional()
        .default([]),
      nutritionHydration: z
        .object({
          meals: z.string().optional().default(''),
          fluidsMl: z.number().optional(),
          notes: z.string().optional().default(''),
        })
        .optional()
        .default({}),
      mobilityActivities: z
        .object({
          activities: z.string().optional().default(''),
          durationMin: z.number().optional(),
          assistanceLevel: z.string().optional().default(''),
        })
        .optional()
        .default({}),
      observations: z.string().optional().default(''),
      caregiverSignature: z.string().min(2),
      timestamp: z.coerce.date().optional(),
    });
    const body = Body.parse(req.body);

    const patient = await Patient.findById(body.patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (req.auth.role === Roles.CAREGIVER) {
      const caregiverId = new mongoose.Types.ObjectId(req.auth.sub);
      const assigned = (patient.assignedCaregivers || []).some((id) => String(id) === String(caregiverId));
      if (!assigned) return res.status(403).json({ error: 'Forbidden' });
    }

    const caregiverId = req.auth.sub;
    const created = await CareLog.create({
      patientId: body.patientId,
      caregiverId,
      vitals: body.vitals,
      medsGiven: body.medsGiven,
      nutritionHydration: body.nutritionHydration,
      mobilityActivities: body.mobilityActivities,
      observations: body.observations,
      caregiverSignature: body.caregiverSignature,
      timestamp: body.timestamp ?? new Date(),
    });

    res.status(201).json({ careLog: { id: String(created._id) } });
  })
);

careLogRoutes.get(
  '/patient/:patientId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = String(req.params.patientId || '');
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if ([Roles.CAREGIVER, Roles.FAMILY_MEMBER].includes(req.auth.role)) {
      const userId = new mongoose.Types.ObjectId(req.auth.sub);
      const ok =
        (patient.assignedCaregivers || []).some((id) => String(id) === String(userId)) ||
        (patient.familyMembers || []).some((id) => String(id) === String(userId));
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    }

    const logs = await CareLog.find({ patientId }).sort({ timestamp: -1 }).limit(limit).lean();

    // Family members get summary only (read-only & minimal)
    if (req.auth.role === Roles.FAMILY_MEMBER) {
      return res.json({
        logs: logs.map((l) => ({
          id: String(l._id),
          timestamp: l.timestamp,
          vitals: l.vitals,
          observations: l.observations,
        })),
      });
    }

    res.json({
      logs: logs.map((l) => ({
        id: String(l._id),
        timestamp: l.timestamp,
        caregiverId: String(l.caregiverId),
        vitals: l.vitals,
        medsGiven: l.medsGiven,
        nutritionHydration: l.nutritionHydration,
        mobilityActivities: l.mobilityActivities,
        observations: l.observations,
        caregiverSignature: l.caregiverSignature,
      })),
    });
  })
);

