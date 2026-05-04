import { z } from 'zod';

const Time12hSchema = z.string().regex(/^\d{2}:\d{2} (AM|PM)$/);

export const DailyScheduleItemSchema = z.object({
  time: Time12hSchema,
  task: z.string().min(1),
  instructions: z.string().min(1),
  type: z.enum(['hydration', 'hygiene', 'medication', 'mobility', 'cognitive', 'nutrition', 'safety', 'other']),
});

export const MedicationPlanItemSchema = z.object({
  medicationName: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  recommendedTime: Time12hSchema,
  reasonForTiming: z.string().min(1),
  withFood: z.enum(['Yes', 'No']),
  sideEffectsNotes: z.string().min(1),
  prescribedBy: z.string().min(1),
});

export const CarePlanOutputSchema = z.object({
  patientOverview: z.object({
    patientName: z.string().min(1),
    dateOfBirth: z.string().min(1), // ISO date string or human readable, but required
    age: z.number().int().nonnegative(),
    condition: z.string().min(1),
    mobilityLevel: z.string().min(1),
    specialNeeds: z.string().min(1),
    allergies: z.string().min(1),
    dateOfReport: z.string().min(1),
  }),

  clinicalSummary: z.object({
    conditionSummary: z.string().min(1),
    riskLevel: z.enum(['Low', 'Moderate', 'High']),
    cognitiveStatus: z.string().min(1),
    physicalStatus: z.string().min(1),
    carePriorityNotes: z.array(z.string().min(1)),
  }),

  dailySchedule: z.object({
    morning: z.array(DailyScheduleItemSchema).min(1),
    afternoon: z.array(DailyScheduleItemSchema).min(1),
    evening: z.array(DailyScheduleItemSchema).min(1),
  }),

  medicationPlan: z.array(MedicationPlanItemSchema),

  vitalSignsMonitoring: z.object({
    bloodPressure: z.string().min(1),
    heartRate: z.string().min(1),
    temperature: z.string().min(1),
    weight: z.string().min(1),
    oxygenSaturation: z.string().min(1),
    measurementFrequency: z.string().min(1),
  }),

  nutritionHydrationPlan: z.object({
    dietType: z.string().min(1),
    mealFrequency: z.string().min(1),
    hydrationTargetMlPerDay: z.number().int().positive(),
    recommendedFoods: z.array(z.string().min(1)),
    foodsToAvoid: z.array(z.string().min(1)),
    feedingAssistanceLevel: z.string().min(1),
  }),

  mobilityActivityPlan: z.object({
    mobilityStatus: z.string().min(1),
    transferAssistanceLevel: z.string().min(1),
    dailyExercisePlan: z.array(z.string().min(1)),
    recommendedActivities: z.array(z.string().min(1)),
    cognitiveActivities: z.array(z.string().min(1)),
    physicalActivities: z.array(z.string().min(1)),
    socialActivities: z.array(z.string().min(1)),
    fallRiskLevel: z.enum(['Low', 'Moderate', 'High']),
    assistiveDevicesNeeded: z.array(z.string().min(1)),
  }),

  safetyPrecautions: z.object({
    homeSafetyModifications: z.array(z.string().min(1)),
    fallPreventionMeasures: z.array(z.string().min(1)),
    emergencyInstructions: z.array(z.string().min(1)),
    wanderingRisk: z.enum(['Low', 'Moderate', 'High', 'Not Applicable']),
    supervisionLevel: z.string().min(1),
  }),

  cognitiveBehavioralSupport: z.object({
    applicable: z.boolean(),
    orientationCues: z.array(z.string().min(1)),
    memorySupportStrategies: z.array(z.string().min(1)),
    behaviorTriggers: z.array(z.string().min(1)),
    calmingTechniques: z.array(z.string().min(1)),
    agitationResponsePlan: z.array(z.string().min(1)),
  }),

  caregiverInstructions: z.object({
    shiftInstructions: z.array(z.string().min(1)),
    priorityTasks: z.array(z.string().min(1)),
    symptomsToMonitor: z.array(z.string().min(1)),
    reportingGuidelines: z.array(z.string().min(1)),
  }),

  observationsNotesLogStructure: z.object({
    moodTracking: z.array(z.string().min(1)),
    behaviorChanges: z.array(z.string().min(1)),
    sleepQuality: z.array(z.string().min(1)),
    appetiteChanges: z.array(z.string().min(1)),
    incidentReports: z.array(z.string().min(1)),
  }),

  careTeamAssignment: z.object({
    assignedCaregivers: z.array(z.object({ userId: z.string().min(1), name: z.string().min(1) })),
    careTeamLeader: z.object({ userId: z.string().min(1), name: z.string().min(1) }).nullable(),
    familyViewers: z.array(z.object({ userId: z.string().min(1), name: z.string().min(1) })),
  }),

  aiGenerationMetadata: z.object({
    aiModelUsed: z.string().min(1),
    temperature: z.number(),
    generatedDate: z.string().min(1),
    promptVersion: z.string().min(1),
  }),

  approvalSignOff: z.object({
    caregiverSignature: z.string().min(1),
    careTeamLeaderReview: z.string().min(1),
    homeCareManagerApproval: z.string().min(1),
  }),
});

