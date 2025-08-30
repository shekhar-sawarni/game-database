import mongoose from 'mongoose';

export const RatingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    mode: { type: String, required: true, index: true },
    rating: { type: Number, required: true }
  },
  { timestamps: true }
);
RatingSchema.index({ userId: 1, mode: 1 }, { unique: true });

export const GameResultSchema = new mongoose.Schema(
  {
    mode: { type: String, required: true, index: true },
    players: [
      {
        user_id: { type: String, required: true },
        score: { type: Number, required: true },
        old_rating: { type: Number },
        new_rating: { type: Number }
      }
    ]
  },
  { timestamps: true }
);


