import mongoose from 'mongoose';

const anonymousIdentitySchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    avatarSeed: {
      type: String,
      default: () => Math.random().toString(36).substring(2, 10)
    },
    bio: {
      type: String,
      maxlength: 160,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true
    },
    suspensionReason: {
      type: String,
      default: ''
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const AnonymousIdentity = mongoose.model('AnonymousIdentity', anonymousIdentitySchema);
