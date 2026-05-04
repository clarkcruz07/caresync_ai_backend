import mongoose from 'mongoose';
import { Roles } from '../middleware/auth.js';

const CaregiverProfileSchema = new mongoose.Schema(
  {
    address: { type: String, default: '' },
    contact: { type: String, default: '' },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: Object.values(Roles),
      index: true,
    },
    caregiverProfile: { type: CaregiverProfileSchema, default: undefined },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', UserSchema);

