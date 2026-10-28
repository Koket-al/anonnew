import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import xss from 'xss';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';
import { ConsultationRequest } from '../models/ConsultationRequest.js';

function generateAdminToken(email) {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_replace_in_production_32bytes_min';
  return jwt.sign(
    { role: 'admin', email: email.toLowerCase().trim() },
    secret,
    { expiresIn: '1d' }
  );
}

/**
 * Admin Login
 * Verifies credentials against server environment variables (ADMIN_EMAIL, ADMIN_PASSWORD)
 */
export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Admin email and password are required.'
      });
    }

    const configuredEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const configuredPassword = process.env.ADMIN_PASSWORD || '';

    if (!configuredEmail || !configuredPassword) {
      return res.status(500).json({
        success: false,
        error: 'Admin authentication is not configured in server environment.'
      });
    }

    const inputEmail = email.toLowerCase().trim();

    if (inputEmail !== configuredEmail || password !== configuredPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator email or password.'
      });
    }

    const token = generateAdminToken(configuredEmail);

    res.cookie('anon_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
      admin: {
        email: configuredEmail,
        role: 'admin'
      },
      message: 'Admin authentication successful.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current admin identity
 */
export async function getAdminMe(req, res) {
  res.json({
    success: true,
    admin: {
      email: req.admin.email,
      role: 'admin'
    }
  });
}

/**
 * List pending doctor and counselor applications
 */
export async function getAdminPendingProfessionals(req, res, next) {
  try {
    const applications = await ProfessionalAccount.find({ verificationStatus: 'pending' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      applications: applications.map((p) => ({
        id: p._id,
        email: p.email,
        fullName: p.fullName,
        displayName: p.displayName,
        licenseType: p.licenseType,
        licenseNumber: p.licenseNumber,
        licenseJurisdiction: p.licenseJurisdiction,
        specialties: p.specialties,
        languages: p.languages,
        bio: p.bio,
        imageUrl: p.imageUrl || '',
        verificationStatus: p.verificationStatus,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all doctors and counselors
 */
export async function getAdminAllProfessionals(req, res, next) {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.verificationStatus = status;
    }

    const professionals = await ProfessionalAccount.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      professionals: professionals.map((p) => ({
        id: p._id,
        email: p.email,
        fullName: p.fullName,
        displayName: p.displayName,
        licenseType: p.licenseType,
        licenseNumber: p.licenseNumber,
        licenseJurisdiction: p.licenseJurisdiction,
        specialties: p.specialties,
        languages: p.languages,
        bio: p.bio,
        imageUrl: p.imageUrl || '',
        verificationStatus: p.verificationStatus,
        verificationNotes: p.verificationNotes,
        verifiedAt: p.verifiedAt,
        acceptingInquiries: p.acceptingInquiries,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Review Application (Approve / Add, or Reject)
 */
export async function reviewProfessionalApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body; // 'verify' or 'reject'

    if (!['verify', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Decision must be "verify" or "reject".'
      });
    }

    const pro = await ProfessionalAccount.findById(id);
    if (!pro) {
      return res.status(404).json({
        success: false,
        error: 'Doctor / counselor application not found.'
      });
    }

    pro.verificationStatus = decision === 'verify' ? 'verified' : 'rejected';
    pro.verifiedAt = decision === 'verify' ? new Date() : null;
    pro.verificationNotes = notes ? xss(String(notes).trim()) : '';
    await pro.save();

    res.json({
      success: true,
      message: `Doctor / counselor application ${decision === 'verify' ? 'approved and added' : 'rejected'} successfully.`,
      professional: {
        id: pro._id,
        displayName: pro.displayName,
        verificationStatus: pro.verificationStatus,
        verifiedAt: pro.verifiedAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Direct Add Doctor / Counselor by Admin
 */
export async function createDirectProfessional(req, res, next) {
  try {
    const {
      fullName,
      displayName,
      email,
      password,
      licenseType,
      licenseNumber,
      licenseJurisdiction,
      specialties,
      languages,
      bio,
      imageUrl
    } = req.body;

    if (!fullName || !displayName || !email || !password || !licenseType || !licenseNumber) {
      return res.status(400).json({
        success: false,
        error: 'Full name, display name, email, password, license type, and license number are required.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long.'
      });
    }

    const existing = await ProfessionalAccount.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A clinician account with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const pro = await ProfessionalAccount.create({
      fullName: xss(fullName.trim()),
      displayName: xss(displayName.trim()),
      email: email.toLowerCase().trim(),
      passwordHash,
      licenseType: xss(licenseType.trim()),
      licenseNumber: xss(licenseNumber.trim()),
      licenseJurisdiction: xss(licenseJurisdiction?.trim() || 'Unspecified'),
      specialties: Array.isArray(specialties) ? specialties.map(s => xss(String(s).trim())).filter(Boolean) : [],
      languages: Array.isArray(languages) ? languages.map(l => xss(String(l).trim())).filter(Boolean) : ['English'],
      bio: bio ? xss(bio.trim().slice(0, 1200)) : '',
      imageUrl: imageUrl ? String(imageUrl).trim() : '',
      verificationStatus: 'verified', // Directly verified by admin
      verifiedAt: new Date(),
      verificationNotes: 'Directly onboarded by platform administrator'
    });

    res.status(201).json({
      success: true,
      message: 'Doctor / counselor added and verified successfully.',
      professional: {
        id: pro._id,
        fullName: pro.fullName,
        displayName: pro.displayName,
        email: pro.email,
        licenseType: pro.licenseType,
        licenseNumber: pro.licenseNumber,
        specialties: pro.specialties,
        languages: pro.languages,
        imageUrl: pro.imageUrl,
        verificationStatus: pro.verificationStatus,
        verifiedAt: pro.verifiedAt,
        createdAt: pro.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a doctor / counselor
 */
export async function deleteProfessional(req, res, next) {
  try {
    const { id } = req.params;

    const pro = await ProfessionalAccount.findById(id);
    if (!pro) {
      return res.status(404).json({
        success: false,
        error: 'Doctor / counselor not found.'
      });
    }

    await ProfessionalAccount.findByIdAndDelete(id);
    await ConsultationRequest.deleteMany({ professional: id });

    res.json({
      success: true,
      message: `Doctor / counselor ${pro.displayName} removed successfully.`
    });
  } catch (error) {
    next(error);
  }
}
