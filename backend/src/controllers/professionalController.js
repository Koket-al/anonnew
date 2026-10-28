import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import xss from 'xss';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';
import { ConsultationRequest } from '../models/ConsultationRequest.js';
import { RevokedToken } from '../models/RevokedToken.js';

function generateProToken(id) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[SECURITY] JWT_SECRET environment variable is missing or too short.');
  }
  // Include role claim so professionalAuth can verify token scope
  return jwt.sign({ id, role: 'professional' }, secret, { expiresIn: '7d', algorithm: 'HS256' });
}

export async function registerProfessional(req, res, next) {
  try {
    const {
      email,
      password,
      fullName,
      displayName,
      licenseType,
      licenseNumber,
      licenseJurisdiction,
      specialties,
      languages,
      bio,
      imageUrl
    } = req.body;

    if (!email || !password || !fullName || !displayName || !licenseType || !licenseNumber) {
      return res.status(400).json({
        success: false,
        error: 'All required registration and credential fields must be filled.'
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
        error: 'An account with this professional email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const professional = await ProfessionalAccount.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName: xss(fullName.trim()),
      displayName: xss(displayName.trim()),
      licenseType: xss(licenseType.trim()),
      licenseNumber: xss(licenseNumber.trim()),
      licenseJurisdiction: xss(licenseJurisdiction?.trim() || 'Unspecified'),
      specialties: Array.isArray(specialties) ? specialties.map(s => xss(String(s).trim())).filter(Boolean) : [],
      languages: Array.isArray(languages) ? languages.map(l => xss(String(l).trim())).filter(Boolean) : ['English'],
      bio: bio ? xss(bio.trim().slice(0, 1200)) : '',
      imageUrl: imageUrl ? String(imageUrl).trim() : '',
      verificationStatus: 'pending' // Always pending manual review
    });

    const token = generateProToken(professional._id);
    res.cookie('anon_pro_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const isExplicitApiClient = req.headers['x-api-client'] === 'true';

    res.status(201).json({
      success: true,
      ...(isExplicitApiClient ? { token } : {}),
      professional: {
        id: professional._id,
        email: professional.email,
        displayName: professional.displayName,
        licenseType: professional.licenseType,
        verificationStatus: professional.verificationStatus,
        createdAt: professional.createdAt
      },
      message: 'Professional account registered. Verification is pending review by platform reviewers before being publicly listed.'
    });
  } catch (error) {
    next(error);
  }
}

export async function loginProfessional(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const professional = await ProfessionalAccount.findOne({ email: email.toLowerCase().trim() });
    if (!professional) {
      return res.status(401).json({ success: false, error: 'Invalid professional email or password.' });
    }

    const isMatch = await bcrypt.compare(password, professional.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid professional email or password.' });
    }

    const token = generateProToken(professional._id);
    res.cookie('anon_pro_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const isExplicitApiClient = req.headers['x-api-client'] === 'true';

    res.json({
      success: true,
      ...(isExplicitApiClient ? { token } : {}),
      professional: {
        id: professional._id,
        email: professional.email,
        displayName: professional.displayName,
        fullName: professional.fullName,
        licenseType: professional.licenseType,
        verificationStatus: professional.verificationStatus,
        specialties: professional.specialties,
        languages: professional.languages,
        bio: professional.bio,
        acceptingInquiries: professional.acceptingInquiries
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutProfessional(req, res) {
  try {
    let token = req.cookies?.anon_pro_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
          expiresAt = new Date(decoded.exp * 1000);
        }
      } catch {}

      await RevokedToken.findOneAndUpdate(
        { tokenHash },
        { tokenHash, tokenType: 'professional', expiresAt, revokedAt: new Date() },
        { upsert: true }
      );
    }

    res.clearCookie('anon_pro_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.json({ success: true, message: 'Professional logged out and token revoked.' });
  } catch (err) {
    res.clearCookie('anon_pro_token');
    res.json({ success: true, message: 'Professional logged out.' });
  }
}

export async function getProfessionalProfile(req, res) {
  res.json({
    success: true,
    professional: {
      id: req.professional._id,
      email: req.professional.email,
      displayName: req.professional.displayName,
      fullName: req.professional.fullName,
      licenseType: req.professional.licenseType,
      licenseNumber: req.professional.licenseNumber,
      licenseJurisdiction: req.professional.licenseJurisdiction,
      verificationStatus: req.professional.verificationStatus,
      verificationNotes: req.professional.verificationNotes,
      specialties: req.professional.specialties,
      languages: req.professional.languages,
      bio: req.professional.bio,
      imageUrl: req.professional.imageUrl || '',
      acceptingInquiries: req.professional.acceptingInquiries
    }
  });
}

export async function updateProfessionalProfile(req, res, next) {
  try {
    const { displayName, specialties, languages, bio, imageUrl, acceptingInquiries } = req.body;
    const pro = await ProfessionalAccount.findById(req.professional._id);

    if (displayName) pro.displayName = xss(displayName.trim());
    if (Array.isArray(specialties)) pro.specialties = specialties.map(s => xss(String(s).trim())).filter(Boolean);
    if (Array.isArray(languages)) pro.languages = languages.map(l => xss(String(l).trim())).filter(Boolean);
    if (bio !== undefined) pro.bio = xss(String(bio).trim().slice(0, 1200));
    if (imageUrl !== undefined) pro.imageUrl = String(imageUrl).trim();
    if (acceptingInquiries !== undefined) pro.acceptingInquiries = Boolean(acceptingInquiries);

    await pro.save();

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      professional: {
        id: pro._id,
        displayName: pro.displayName,
        specialties: pro.specialties,
        languages: pro.languages,
        bio: pro.bio,
        imageUrl: pro.imageUrl || '',
        acceptingInquiries: pro.acceptingInquiries
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function listVerifiedProfessionals(req, res, next) {
  try {
    const { specialty } = req.query;

    const query = {
      verificationStatus: 'verified' // NEVER show unverified or pending to ordinary users
    };

    if (specialty && specialty !== 'All') {
      query.specialties = specialty;
    }

    const professionals = await ProfessionalAccount.find(query)
      .select('displayName licenseType specialties languages bio imageUrl acceptingInquiries verifiedAt')
      .sort({ verifiedAt: -1 });

    res.json({
      success: true,
      professionals: professionals.map(p => ({
        id: p._id,
        displayName: p.displayName,
        licenseType: p.licenseType,
        specialties: p.specialties,
        languages: p.languages,
        bio: p.bio,
        imageUrl: p.imageUrl || '',
        acceptingInquiries: p.acceptingInquiries,
        verified: true
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function submitConsultationRequest(req, res, next) {
  try {
    const { professionalId, topic, message, urgency = 'general' } = req.body;

    if (!professionalId) {
      return res.status(400).json({ success: false, error: 'Professional ID is required.' });
    }

    if (!topic || topic.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Topic must be at least 3 characters.' });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Message must be at least 10 characters.' });
    }

    const professional = await ProfessionalAccount.findOne({
      _id: professionalId,
      verificationStatus: 'verified'
    });

    if (!professional) {
      return res.status(404).json({ success: false, error: 'Verified professional not found.' });
    }

    const request = await ConsultationRequest.create({
      professional: professional._id,
      identity: req.identity._id,
      topic: xss(topic.trim()),
      message: xss(message.trim()),
      urgency
    });

    res.status(201).json({
      success: true,
      consultationId: request._id,
      message: 'Consultation request submitted anonymously to ' + professional.displayName + '.'
    });
  } catch (error) {
    next(error);
  }
}

export async function getConsultationsForProfessional(req, res, next) {
  try {
    const consultations = await ConsultationRequest.find({ professional: req.professional._id })
      .sort({ createdAt: -1 })
      .populate('identity', 'username avatarSeed');

    res.json({
      success: true,
      consultations: consultations.map(c => ({
        id: c._id,
        anonymousUser: c.identity ? {
          username: c.identity.username,
          avatarSeed: c.identity.avatarSeed
        } : { username: 'Anonymous' },
        topic: c.topic,
        message: c.message,
        urgency: c.urgency,
        status: c.status,
        response: c.response,
        respondedAt: c.respondedAt,
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function respondToConsultation(req, res, next) {
  try {
    const { id } = req.params;
    const { response } = req.body;

    if (!response || response.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Response must be at least 5 characters.' });
    }

    const consultation = await ConsultationRequest.findOne({
      _id: id,
      professional: req.professional._id
    });

    if (!consultation) {
      return res.status(404).json({ success: false, error: 'Consultation request not found.' });
    }

    consultation.response = xss(response.trim());
    consultation.status = 'responded';
    consultation.respondedAt = new Date();
    await consultation.save();

    res.json({
      success: true,
      message: 'Response sent to the anonymous user.',
      consultation: {
        id: consultation._id,
        status: consultation.status,
        response: consultation.response,
        respondedAt: consultation.respondedAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyAnonymousConsultations(req, res, next) {
  try {
    const consultations = await ConsultationRequest.find({ identity: req.identity._id })
      .sort({ createdAt: -1 })
      .populate('professional', 'displayName licenseType specialties');

    res.json({
      success: true,
      consultations: consultations.map(c => ({
        id: c._id,
        professional: c.professional ? {
          id: c.professional._id,
          displayName: c.professional.displayName,
          licenseType: c.professional.licenseType
        } : null,
        topic: c.topic,
        message: c.message,
        urgency: c.urgency,
        status: c.status,
        response: c.response,
        respondedAt: c.respondedAt,
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}
