import mongoose from 'mongoose';

const communityMembershipSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true
    },
    identity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'creator'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

communityMembershipSchema.index({ community: 1, identity: 1 }, { unique: true });

export const CommunityMembership = mongoose.model('CommunityMembership', communityMembershipSchema);
