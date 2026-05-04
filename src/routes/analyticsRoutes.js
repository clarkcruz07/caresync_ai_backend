import express from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Roles, requireAuth, requireRole } from '../middleware/auth.js';
import { Patient } from '../models/Patient.js';
import { CareLog } from '../models/CareLog.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const analyticsRoutes = express.Router();

analyticsRoutes.get(
  '/overview',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.HOME_CARE_MANAGER, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const [patientCount, logCount] = await Promise.all([Patient.countDocuments(), CareLog.countDocuments()]);

    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs7d = await CareLog.aggregate([
      { $match: { timestamp: { $gte: last7d } } },
      { $group: { _id: '$caregiverId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const adherenceProxy = await CareLog.aggregate([
      { $match: { timestamp: { $gte: last7d } } },
      {
        $project: {
          hasMeds: { $gt: [{ $size: { $ifNull: ['$medsGiven', []] } }, 0] },
          timestamp: 1,
        },
      },
      { $group: { _id: null, withMeds: { $sum: { $cond: ['$hasMeds', 1, 0] } }, total: { $sum: 1 } } },
    ]);

    res.json({
      patientCount,
      careLogCount: logCount,
      caregiverActivityTop: logs7d.map((x) => ({ caregiverId: String(x._id), logsLast7d: x.count })),
      medicationAdherenceInsight: adherenceProxy?.[0]
        ? { logsWithMedicationRecordedLast7d: adherenceProxy[0].withMeds, totalLogsLast7d: adherenceProxy[0].total }
        : { logsWithMedicationRecordedLast7d: 0, totalLogsLast7d: 0 },
    });
  })
);

