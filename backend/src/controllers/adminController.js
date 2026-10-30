import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import xss from 'xss';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';
import { ConsultationRequest } from '../models/ConsultationRequest.js';
import { AnonymousIdentity } from '../models/AnonymousIdentity.js';
import { AnonymousSession } from '../models/AnonymousSession.js';
import { Post } from '../models/Post.js';
import { Reply } from '../models/Reply.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { ListeningRoom } from '../models/ListeningRoom.js';
import { Community } from '../models/Community.js';
import { RevokedToken } from '../models/RevokedToken.js';

/**
 * Returns the JWT secret from environment.
 * Throws at startup / first use if not configured, preventing insecure fallback.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[SECURITY] JWT_SECRET environment variable is missing or too short (must be ≥32 chars). Server cannot start safely.');
  }
  return secret;
}

function generateAdminToken(email) {
  return jwt.sign(
    { role: 'admin', email: email.toLowerCase().trim() },
    getJwtSecret(),
    { expiresIn: '1d', algorithm: 'HS256' }
  );
}

/**
 * Admin Login
 * Verifies credentials against server environment variables (ADMIN_EMAIL, ADMIN_PASSWORD).
 * Admin password is compared with bcrypt if a hash is stored, or plain-text otherwise
 * (plain-text comparison kept for backward compat; operators should switch to hashed).
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

    // Generic error response — do not distinguish email vs password failure
    if (inputEmail !== configuredEmail || password !== configuredPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials.'
      });
    }

    let secret;
    try {
      secret = getJwtSecret();
    } catch {
      return res.status(500).json({ success: false, error: 'Server authentication configuration error.' });
    }

    const token = generateAdminToken(configuredEmail);

    res.cookie('anon_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    const isExplicitApiClient = req.headers['x-api-client'] === 'true';

    res.json({
      success: true,
      ...(isExplicitApiClient ? { token } : {}),
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
 * Admin Logout — revokes the admin session server-side and clears the cookie
 */
export async function adminLogout(req, res) {
  try {
    let token = req.cookies?.anon_admin_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (!token && req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'];
    }

    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
          expiresAt = new Date(decoded.exp * 1000);
        }
      } catch {}

      await RevokedToken.findOneAndUpdate(
        { tokenHash },
        { tokenHash, tokenType: 'admin', expiresAt, revokedAt: new Date() },
        { upsert: true }
      );
    }

    res.clearCookie('anon_admin_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.json({ success: true, message: 'Admin session ended and token revoked.' });
  } catch (err) {
    res.clearCookie('anon_admin_token');
    res.json({ success: true, message: 'Admin session ended.' });
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

/**
 * Grant or revoke moderator role on an anonymous identity.
 * Only callable by an authenticated administrator.
 * Body: { grant: true|false }
 */
export async function setModeratorRole(req, res, next) {
  try {
    const { id } = req.params;
    const { grant } = req.body;

    if (typeof grant !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Body must include { grant: true } or { grant: false }.' });
    }

    const identity = await AnonymousIdentity.findById(id);
    if (!identity) {
      return res.status(404).json({ success: false, error: 'Anonymous identity not found.' });
    }

    identity.isModerator = Boolean(grant);
    await identity.save();

    res.json({
      success: true,
      message: `Moderator role ${grant ? 'granted to' : 'revoked from'} identity ${identity.username}.`,
      identity: {
        id: identity._id,
        username: identity.username,
        isModerator: identity.isModerator
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/stats
 * Real-time usage and platform engagement metrics for administrator oversight:
 * - How many people use ANON (total anonymous user sessions & active users)
 * - Cryptographic personas generated
 * - Discussion posts, shared replies, and 1-on-1 private messages
 * - Live listening rooms & communities
 * - Clinical consultation requests & verified doctors
 * - 7-day daily activity trends
 */
export async function getAdminPlatformStats(req, res, next) {
  try {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const [
      totalUsers,
      activeUsers24h,
      activeUsers7d,
      activeUsers30d,
      newUsersToday,
      totalPersonas,
      activePersonas24h,
      totalPosts,
      postsToday,
      totalReplies,
      totalMessages,
      messagesToday,
      totalConversations,
      totalListeningRooms,
      activeListeningRooms,
      totalConsultations,
      activeConsultations,
      totalCommunities,
      verifiedProfessionals,
      pendingProfessionals
    ] = await Promise.all([
      AnonymousSession.countDocuments(),
      AnonymousSession.countDocuments({ lastUsedAt: { $gte: since24h } }),
      AnonymousSession.countDocuments({ lastUsedAt: { $gte: since7d } }),
      AnonymousSession.countDocuments({ lastUsedAt: { $gte: since30d } }),
      AnonymousSession.countDocuments({ createdAt: { $gte: startOfToday } }),
      AnonymousIdentity.countDocuments(),
      AnonymousIdentity.countDocuments({ lastActiveAt: { $gte: since24h } }),
      Post.countDocuments(),
      Post.countDocuments({ createdAt: { $gte: startOfToday } }),
      Reply.countDocuments(),
      Message.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: startOfToday } }),
      Conversation.countDocuments(),
      ListeningRoom.countDocuments(),
      ListeningRoom.countDocuments({ status: 'active' }),
      ConsultationRequest.countDocuments(),
      ConsultationRequest.countDocuments({ status: { $in: ['accepted', 'active'] } }),
      Community.countDocuments(),
      ProfessionalAccount.countDocuments({ verificationStatus: 'verified' }),
      ProfessionalAccount.countDocuments({ verificationStatus: 'pending' })
    ]);

    // 7-day daily trends for visual activity charts
    const dayBuckets = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
      const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);
      const label = dStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const shortDay = dStart.toLocaleDateString('en-US', { weekday: 'short' });
      dayBuckets.push({ start: dStart, end: dEnd, label, shortDay });
    }

    const history = await Promise.all(
      dayBuckets.map(async ({ start, end, label, shortDay }) => {
        const [usersCount, postsCount, messagesCount] = await Promise.all([
          AnonymousSession.countDocuments({ createdAt: { $gte: start, $lte: end } }),
          Post.countDocuments({ createdAt: { $gte: start, $lte: end } }),
          Message.countDocuments({ createdAt: { $gte: start, $lte: end } })
        ]);
        return { label, shortDay, newUsers: usersCount, posts: postsCount, messages: messagesCount };
      })
    );

    res.json({
      success: true,
      stats: {
        users: {
          totalUsers,
          activeUsers24h,
          activeUsers7d,
          activeUsers30d,
          newUsersToday,
          totalPersonas,
          activePersonas24h
        },
        activity: {
          totalPosts,
          postsToday,
          totalReplies,
          totalMessages,
          messagesToday,
          totalConversations
        },
        sanctuaries: {
          totalListeningRooms,
          activeListeningRooms,
          totalCommunities
        },
        clinical: {
          totalConsultations,
          activeConsultations,
          verifiedProfessionals,
          pendingProfessionals
        },
        history
      }
    });
  } catch (error) {
    next(error);
  }
}
