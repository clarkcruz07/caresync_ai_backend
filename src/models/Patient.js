import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    DOB: { type: Date, required: true },
    condition: { type: String, required: true, trim: true },
    mobility: { type: String, required: true, trim: true },
    assignedCaregivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    familyMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    currentCarePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarePlan', default: null },
  },
  { timestamps: true }
);

export const Patient = mongoose.model('Patient', PatientSchema);

