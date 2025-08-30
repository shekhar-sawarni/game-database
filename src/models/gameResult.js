import mongoose from 'mongoose';

const GameResultSchema = new mongoose.Schema(
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

export const GameResultModel = mongoose.models.GameResult || mongoose.model('GameResult', GameResultSchema);


