import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnonymousIdentity',
        required: true
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked', 'closed'],
      default: 'pending',
      index: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true
    },
    initialNote: {
      type: String,
      maxlength: 300,
      default: ''
    },
    relatedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null
    },
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'AnonymousIdentity' },
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
