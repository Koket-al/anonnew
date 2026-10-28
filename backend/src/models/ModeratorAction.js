import mongoose from 'mongoose';

const moderatorActionSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: [
        'dismiss_report',
        'remove_post',
        'remove_reply',
        'suspend_identity',
        'unsuspend_identity',
        'close_room',
        'verify_professional',
        'reject_professional',
        'suspend_professional'
      ],
      required: true,
      index: true
    },
    targetType: {
      type: String,
      required: true
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    performedBy: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

moderatorActionSchema.index({ createdAt: -1 });

export const ModeratorAction = mongoose.model('ModeratorAction', moderatorActionSchema);
