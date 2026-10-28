import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    targetType: {
      type: String,
      enum: ['post', 'reply', 'community', 'user', 'listening_room', 'message'],
      required: true,
      index: true
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    reason: {
      type: String,
      enum: [
        'harassment',
        'threat_or_harm',
        'doxxing_or_pii',
        'hate_speech',
        'spam_or_solicitation',
        'medical_misinformation',
        'other'
      ],
      required: true
    },
    explanation: {
      type: String,
      maxlength: 600,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved_action_taken', 'resolved_dismissed'],
      default: 'pending',
      index: true
    },
    reviewedBy: {
      type: String,
      default: null
    },
    resolutionNotes: {
      type: String,
      default: ''
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
