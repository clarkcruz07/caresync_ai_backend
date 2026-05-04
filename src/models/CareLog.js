import mongoose from 'mongoose';

const CareLogSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vitals: {
      heartRate: { type: Number },
      systolicBP: { type: Number },
      diastolicBP: { type: Number },
      temperatureC: { type: Number },
      spo2: { type: Number },
    },
    medsGiven: [
      {
        name: { type: String, required: true },
        dose: { type: String, default: '' },
        time: { type: String, default: '' },
        notes: { type: String, default: '' },
      },
    ],
    nutritionHydration: {
      meals: { type: String, default: '' },
      fluidsMl: { type: Number },
      notes: { type: String, default: '' },
    },
    mobilityActivities: {
      activities: { type: String, default: '' },
      durationMin: { type: Number },
      assistanceLevel: { type: String, default: '' },
    },
    observations: { type: String, default: '' },
    caregiverSignature: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

export const CareLog = mongoose.model('CareLog', CareLogSchema);

