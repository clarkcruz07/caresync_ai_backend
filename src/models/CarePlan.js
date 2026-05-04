import mongoose from 'mongoose';

const CarePlanSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    aiGeneratedPlan: { type: Object, required: true },
    medicationSchedule: { type: Array, required: true, default: [] },
    editableOverrides: { type: Object, default: {} },
    approvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const CarePlan = mongoose.model('CarePlan', CarePlanSchema);

