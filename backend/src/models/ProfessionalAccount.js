import mongoose from 'mongoose';

const professionalAccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
      // Private to review team
    },
    displayName: {
      type: String,
      required: true,
      trim: true
      // Publicly visible e.g. "Dr. Sarah M., LMFT"
    },
    licenseType: {
      type: String,
      required: true,
      trim: true
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true
      // Protected credential
    },
    licenseJurisdiction: {
      type: String,
      required: true,
      trim: true
    },
    specialties: {
      type: [String],
      default: []
    },
    languages: {
      type: [String],
      default: ['English']
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: ''
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      index: true
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    verificationNotes: {
      type: String,
      default: ''
    },
    acceptingInquiries: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export const ProfessionalAccount = mongoose.model('ProfessionalAccount', professionalAccountSchema);
