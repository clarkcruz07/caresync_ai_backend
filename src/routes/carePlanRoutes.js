import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Roles, requireAuth, requireRole } from '../middleware/auth.js';
import { Patient } from '../models/Patient.js';
import { CarePlan } from '../models/CarePlan.js';
import { groqJsonChat } from '../services/groqService.js';
import { CarePlanOutputSchema } from '../validators/carePlanSchemas.js';
import { User } from '../models/User.js';

export const carePlanRoutes = express.Router();

function calcAge(dob) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

function pickMedicationTimingFallback({ condition, medicationName }) {
  const c = String(condition || '').toLowerCase();
  const m = String(medicationName || '').toLowerCase();

  const cognitiveCondition = /(dementia|alzheimer|parkinson|cognitive|memory)/i.test(c);
  const cardioCondition = /(cardio|cardiac|heart|hypertension|blood pressure|stroke|coronary|afib|atrial|chf|heart failure)/i.test(c);

  const cognitiveMed = /(donepezil|memantine|rivastigmine|galantamine|levodopa|carbidopa)/i.test(m);
  const cardioMed = /(amlodipine|lisinopril|losartan|valsartan|metoprolol|atenolol|carvedilol|hydrochlorothiazide|furosemide|spironolactone|aspirin|clopidogrel|warfarin|apixaban|rivaroxaban|dabigatran)/i.test(m);

  // Keep this intentionally simple and consistent for training data stability.
  if (cognitiveMed || cognitiveCondition) {
    return {
      recommendedTime: '08:00 PM',
      reasonForTiming:
        'Recommended in the evening for cognitive support routines and to reduce daytime disruption. Follow prescriber instructions if timing differs.',
    };
  }
  if (cardioMed || cardioCondition) {
    return {
      recommendedTime: '08:00 AM',
      reasonForTiming:
        'Recommended in the morning to align with daytime cardiovascular monitoring and routine blood pressure/heart rate support. Follow prescriber instructions if timing differs.',
    };
  }
  return null;
}

async function generateValidatedCarePlanJson({ system, user, schemaHint, maxAttempts }) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const generated = await groqJsonChat({ system, user, schemaHint });
      const parsed = CarePlanOutputSchema.safeParse(generated);
      if (parsed.success) return parsed.data;
      lastErr = parsed.error;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('AI generation failed');
}

carePlanRoutes.post(
  '/generate',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER, Roles.CAREGIVER]),
  asyncHandler(async (req, res) => {
    const Body = z.object({
      patientId: z.string().min(1),
      patientName: z.string().min(1),
      condition: z.string().min(1),
      mobility: z.enum(['Independent', 'Limited', 'Bedridden']).or(z.string().min(1)),
      specialNeeds: z.string().optional().default(''),
      allergies: z.string().optional().default('None reported'),
      medications: z
        .array(
          z.object({
            medicationName: z.string().min(1),
            dosage: z.string().min(1),
            frequency: z.string().min(1),
            prescribedBy: z.string().min(1).default('Physician'),
            withFood: z.enum(['Yes', 'No']).optional(),
          })
        )
        .default([]),
    });
    const body = Body.parse(req.body);

    const patient = await Patient.findById(body.patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Caregiver can only generate for assigned patients
    if (req.auth.role === Roles.CAREGIVER) {
      const caregiverId = new mongoose.Types.ObjectId(req.auth.sub);
      const assigned = (patient.assignedCaregivers || []).some((id) => String(id) === String(caregiverId));
      if (!assigned) return res.status(403).json({ error: 'Forbidden' });
    }

    const caregivers = await User.find({ _id: { $in: patient.assignedCaregivers || [] } }).select('_id name').lean();
    const family = await User.find({ _id: { $in: patient.familyMembers || [] } }).select('_id name').lean();
    const assignedCaregivers = caregivers.map((u) => ({ userId: String(u._id), name: u.name }));
    const familyViewers = family.map((u) => ({ userId: String(u._id), name: u.name }));

    const careTeamLeader =
      req.auth.role === Roles.CARE_TEAM_LEADER || req.auth.role === Roles.SUPER_ADMIN
        ? { userId: String(req.auth.sub), name: req.auth.name || 'Care Team Leader' }
        : null;

    const schemaHint = {
      patientOverview: {
        patientName: 'string',
        dateOfBirth: 'YYYY-MM-DD',
        age: 0,
        condition: 'string',
        mobilityLevel: 'string',
        specialNeeds: 'string',
        allergies: 'string',
        dateOfReport: 'YYYY-MM-DD',
      },
      clinicalSummary: {
        conditionSummary: 'string',
        riskLevel: 'Low|Moderate|High',
        cognitiveStatus: 'string',
        physicalStatus: 'string',
        carePriorityNotes: ['string'],
      },
      dailySchedule: {
        morning: [{ time: 'HH:MM AM/PM', task: 'string', instructions: 'string', type: 'hydration|hygiene|medication|mobility|cognitive|nutrition|safety|other' }],
        afternoon: [{ time: 'HH:MM AM/PM', task: 'string', instructions: 'string', type: 'hydration|hygiene|medication|mobility|cognitive|nutrition|safety|other' }],
        evening: [{ time: 'HH:MM AM/PM', task: 'string', instructions: 'string', type: 'hydration|hygiene|medication|mobility|cognitive|nutrition|safety|other' }],
      },
      medicationPlan: [
        {
          medicationName: 'string',
          dosage: 'string',
          frequency: 'string',
          recommendedTime: 'HH:MM AM/PM',
          reasonForTiming: 'string',
          withFood: 'Yes|No',
          sideEffectsNotes: 'string',
          prescribedBy: 'string',
        },
      ],
      vitalSignsMonitoring: {
        bloodPressure: 'string',
        heartRate: 'string',
        temperature: 'string',
        weight: 'string',
        oxygenSaturation: 'string',
        measurementFrequency: 'string',
      },
      nutritionHydrationPlan: {
        dietType: 'string',
        mealFrequency: 'string',
        hydrationTargetMlPerDay: 1500,
        recommendedFoods: ['string'],
        foodsToAvoid: ['string'],
        feedingAssistanceLevel: 'string',
      },
      mobilityActivityPlan: {
        mobilityStatus: 'string',
        transferAssistanceLevel: 'string',
        dailyExercisePlan: ['string'],
        recommendedActivities: ['string'],
        cognitiveActivities: ['string'],
        physicalActivities: ['string'],
        socialActivities: ['string'],
        fallRiskLevel: 'Low|Moderate|High',
        assistiveDevicesNeeded: ['string'],
      },
      safetyPrecautions: {
        homeSafetyModifications: ['string'],
        fallPreventionMeasures: ['string'],
        emergencyInstructions: ['string'],
        wanderingRisk: 'Low|Moderate|High|Not Applicable',
        supervisionLevel: 'string',
      },
      cognitiveBehavioralSupport: {
        applicable: true,
        orientationCues: ['string'],
        memorySupportStrategies: ['string'],
        behaviorTriggers: ['string'],
        calmingTechniques: ['string'],
        agitationResponsePlan: ['string'],
      },
      caregiverInstructions: {
        shiftInstructions: ['string'],
        priorityTasks: ['string'],
        symptomsToMonitor: ['string'],
        reportingGuidelines: ['string'],
      },
      observationsNotesLogStructure: {
        moodTracking: ['string'],
        behaviorChanges: ['string'],
        sleepQuality: ['string'],
        appetiteChanges: ['string'],
        incidentReports: ['string'],
      },
      careTeamAssignment: {
        assignedCaregivers: [{ userId: 'string', name: 'string' }],
        careTeamLeader: { userId: 'string', name: 'string' },
        familyViewers: [{ userId: 'string', name: 'string' }],
      },
      aiGenerationMetadata: {
        aiModelUsed: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        generatedDate: 'YYYY-MM-DD',
        promptVersion: 'v1',
      },
      approvalSignOff: {
        caregiverSignature: 'string',
        careTeamLeaderReview: 'string',
        homeCareManagerApproval: 'string',
      },
    };

    const system = [
      'You are a clinical home-care planning assistant.',
      'Return ONLY a single JSON object that exactly matches the schema hint.',
      'No markdown, no prose, no extra keys.',
      'Be conservative and medical-grade. Avoid unsafe/diagnostic claims.',
      'Fill ALL sections in the schema hint (1-14).',
      'Daily Schedule must include time, task, instructions, and type for each item.',
      'Medication Plan must include recommended time and reason-for-timing logic (condition/drug type/interactions/meal dependency/morning-evening effectiveness).',
      'Medication Entries MUST always include: Name, Dosage, Recommended Time, Reason for Timing.',
      'Timing rule: cardiovascular-support medications -> morning; cognitive-support medications -> evening; always include a clear reason sentence.',
      'Times must be in "HH:MM AM/PM" format.',
      'Use neutral, non-diagnostic language. Avoid changing prescribed meds; only schedule & monitoring guidance.',
    ].join('\n');

    const dob = patient.DOB ? new Date(patient.DOB) : null;
    const dobIso = dob ? dob.toISOString().slice(0, 10) : '';
    const dateOfReport = new Date().toISOString().slice(0, 10);

    const user = {
      patient: {
        name: body.patientName,
        dateOfBirth: dobIso,
        age: dob ? calcAge(dob) : 0,
        condition: body.condition,
        mobility: body.mobility,
        specialNeeds: body.specialNeeds || 'None specified',
        allergies: body.allergies || 'None reported',
        dateOfReport,
      },
      physicianMedications: body.medications,
      careTeam: {
        assignedCaregivers,
        careTeamLeader,
        familyViewers,
      },
      aiMetadata: {
        aiModelUsed: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        generatedDate: dateOfReport,
        promptVersion: 'v1',
      },
    };

    let data;
    try {
      data = await generateValidatedCarePlanJson({ system, user, schemaHint, maxAttempts: 3 });
    } catch (e) {
      const details = e?.flatten ? e.flatten() : undefined;
      return res.status(502).json({ error: 'AI output invalid', details });
    }

    // Ensure server-canonical metadata & assignments are not tampered by the model
    data.careTeamAssignment = {
      assignedCaregivers,
      careTeamLeader,
      familyViewers,
    };
    data.aiGenerationMetadata = {
      aiModelUsed: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      generatedDate: dateOfReport,
      promptVersion: 'v2',
    };
    data.patientOverview = {
      ...data.patientOverview,
      patientName: body.patientName,
      dateOfBirth: dobIso,
      age: dob ? calcAge(dob) : data.patientOverview.age,
      condition: body.condition,
      mobilityLevel: body.mobility,
      specialNeeds: body.specialNeeds || 'None specified',
      allergies: body.allergies || 'None reported',
      dateOfReport,
    };

    // Evidence tracking: signature should reflect the authenticated generator (not AI text).
    data.approvalSignOff = {
      ...data.approvalSignOff,
      caregiverSignature: req.auth.name || 'Signed',
    };

    // Enforce stable medication timing intelligence as a fallback (non-breaking).
    data.medicationPlan = (data.medicationPlan || []).map((m) => {
      const fb = pickMedicationTimingFallback({ condition: body.condition, medicationName: m.medicationName });
      if (!fb) return m;
      return {
        ...m,
        recommendedTime: m.recommendedTime || fb.recommendedTime,
        reasonForTiming: m.reasonForTiming || fb.reasonForTiming,
      };
    });

    const planDoc = await CarePlan.create({
      patientId: body.patientId,
      aiGeneratedPlan: data,
      medicationSchedule: data.medicationPlan,
      editableOverrides: {},
      approvedByUserId: null,
    });

    await Patient.updateOne({ _id: body.patientId }, { $set: { currentCarePlanId: planDoc._id } });

    res.status(201).json({
      carePlan: {
        id: String(planDoc._id),
        patientId: String(planDoc.patientId),
        aiGeneratedPlan: planDoc.aiGeneratedPlan,
        medicationSchedule: planDoc.medicationSchedule,
        editableOverrides: planDoc.editableOverrides,
        approvedByUserId: planDoc.approvedByUserId,
        createdAt: planDoc.createdAt,
      },
    });
  })
);

carePlanRoutes.get(
  '/patient/:patientId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = String(req.params.patientId || '');
    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // RBAC: caregiver/family only for assigned patient
    if ([Roles.CAREGIVER, Roles.FAMILY_MEMBER].includes(req.auth.role)) {
      const userId = new mongoose.Types.ObjectId(req.auth.sub);
      const ok =
        (patient.assignedCaregivers || []).some((id) => String(id) === String(userId)) ||
        (patient.familyMembers || []).some((id) => String(id) === String(userId));
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    }

    if (!patient.currentCarePlanId) return res.json({ carePlan: null });
    const plan = await CarePlan.findById(patient.currentCarePlanId).lean();
    if (!plan) return res.json({ carePlan: null });
    res.json({
      carePlan: {
        id: String(plan._id),
        patientId: String(plan.patientId),
        aiGeneratedPlan: plan.aiGeneratedPlan,
        medicationSchedule: plan.medicationSchedule,
        editableOverrides: plan.editableOverrides,
        approvedByUserId: plan.approvedByUserId ? String(plan.approvedByUserId) : null,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
  })
);

carePlanRoutes.get(
  '/patient/:patientId/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = String(req.params.patientId || '');
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // RBAC: caregiver/family only for assigned patient
    if ([Roles.CAREGIVER, Roles.FAMILY_MEMBER].includes(req.auth.role)) {
      const userId = new mongoose.Types.ObjectId(req.auth.sub);
      const ok =
        (patient.assignedCaregivers || []).some((id) => String(id) === String(userId)) ||
        (patient.familyMembers || []).some((id) => String(id) === String(userId));
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    }

    const plans = await CarePlan.find({ patientId }).sort({ createdAt: -1 }).limit(limit).lean();

    res.json({
      carePlans: plans.map((p) => ({
        id: String(p._id),
        createdAt: p.createdAt,
        patientOverview: p.aiGeneratedPlan?.patientOverview,
        medicationPlan: p.aiGeneratedPlan?.medicationPlan,
        approvalSignOff: p.aiGeneratedPlan?.approvalSignOff,
        aiGenerationMetadata: p.aiGeneratedPlan?.aiGenerationMetadata,
      })),
    });
  })
);

carePlanRoutes.patch(
  '/:id',
  requireAuth,
  requireRole([Roles.SUPER_ADMIN, Roles.CARE_TEAM_LEADER]),
  asyncHandler(async (req, res) => {
    const Params = z.object({ id: z.string().min(1) });
    const Body = z.object({
      medicationSchedule: z.array(z.any()).optional(),
      editableOverrides: z.record(z.any()).optional(),
      approve: z.boolean().optional(),
    });
    const { id } = Params.parse(req.params);
    const body = Body.parse(req.body);

    const update = {};
    if (body.medicationSchedule) update.medicationSchedule = body.medicationSchedule;
    if (body.editableOverrides) update.editableOverrides = body.editableOverrides;
    if (body.approve === true) update.approvedByUserId = req.auth.sub;
    if (Object.keys(update).length === 0) return res.json({ ok: true });

    await CarePlan.updateOne({ _id: id }, { $set: update });
    res.json({ ok: true });
  })
);

