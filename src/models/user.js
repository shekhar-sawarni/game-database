import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, unique: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true },
    countryCode: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2, index: true },
    region: { type: String, required: true, uppercase: true, index: true },
    emailVerified: { type: Boolean, required: true, default: false },
    twoFactor: {
      enabled: { type: Boolean, required: true, default: false },
      secret: { type: String, required: false }
    },
    passwordChangedAt: { type: Date, required: false }
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);


