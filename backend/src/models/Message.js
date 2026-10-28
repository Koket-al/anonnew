import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
