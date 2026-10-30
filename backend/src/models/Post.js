import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      default: null,
      index: true
    },
    category: {
      type: String,
      default: 'General Discussion',
      trim: true,
      index: true
    },
    hasBeenThroughThis: {
      type: Boolean,
      default: false,
      index: true
    },
    beenThroughThisCount: {
      type: Number,
      default: 0
    },
    beenThroughThisUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnonymousIdentity'
      }
    ],
    replyCount: {
      type: Number,
      default: 0
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date,
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedReason: {
      type: String,
      default: ''
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ lastActivityAt: -1 });

export const Post = mongoose.model('Post', postSchema);
