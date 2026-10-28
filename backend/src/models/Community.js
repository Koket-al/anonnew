import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    rules: {
      type: [String],
      default: [
        'Be respectful and kind to others.',
        'Do not share personal identifying information.',
        'No hate speech, threats, or harassment.'
      ]
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    inviteCode: {
      type: String,
      default: null,
      index: true
    },
    joinRequests: [
      {
        identity: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AnonymousIdentity',
          required: true
        },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    memberCount: {
      type: Number,
      default: 1
    },
    postCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export const Community = mongoose.model('Community', communitySchema);
