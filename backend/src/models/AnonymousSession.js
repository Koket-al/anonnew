import mongoose from 'mongoose';

const anonymousSessionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    identity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: false,
      default: null,
      index: true
    },
    identities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnonymousIdentity'
      }
    ],
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index automatically expires documents
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const AnonymousSession = mongoose.model('AnonymousSession', anonymousSessionSchema);
