import mongoose from 'mongoose';

const revokedTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    tokenType: {
      type: String,
      enum: ['admin', 'professional', 'anonymous'],
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index automatically purges expired records
    },
    revokedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const RevokedToken = mongoose.model('RevokedToken', revokedTokenSchema);
