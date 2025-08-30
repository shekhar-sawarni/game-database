import mongoose from 'mongoose';

const RatingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    mode: { type: String, required: true, index: true },
    rating: { type: Number, required: true },
  },
  { timestamps: true }
);
RatingSchema.index({ userId: 1, mode: 1 }, { unique: true });

export const RatingModel = mongoose.models.Rating || mongoose.model('Rating', RatingSchema);


