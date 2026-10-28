import mongoose from 'mongoose';

const listeningRoomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    topic: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    guidelines: {
      type: String,
      default: 'Sometimes people need to be heard, not advised. Ask whether advice is welcome before giving it.'
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true
    },
    activeParticipants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnonymousIdentity'
      }
    ],
    maxParticipants: {
      type: Number,
      default: 12
    },
    isClosed: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

listeningRoomSchema.index({ isClosed: 1, createdAt: -1 });

export const ListeningRoom = mongoose.model('ListeningRoom', listeningRoomSchema);
