import mongoose from 'mongoose';

const consultationRequestSchema = new mongoose.Schema(
  {
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProfessionalAccount',
      required: true,
      index: true
    },
    identity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousIdentity',
      required: true,
      index: true
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2500
    },
    urgency: {
      type: String,
      enum: ['general', 'soon', 'pressing'],
      default: 'general'
    },
    status: {
      type: String,
      enum: ['new', 'in_review', 'responded', 'closed'],
      default: 'new',
      index: true
    },
    response: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: ''
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

consultationRequestSchema.index({ professional: 1, createdAt: -1 });
consultationRequestSchema.index({ identity: 1, createdAt: -1 });

export const ConsultationRequest = mongoose.model('ConsultationRequest', consultationRequestSchema);
