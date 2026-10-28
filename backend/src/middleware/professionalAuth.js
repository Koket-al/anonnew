import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';
import { RevokedToken } from '../models/RevokedToken.js';

/**
 * Returns the JWT secret from environment.
 * Throws if not configured, preventing any insecure fallback.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[SECURITY] JWT_SECRET environment variable is missing or too short (must be ≥32 chars).');
  }
  return secret;
}

export async function requireProfessionalAuth(req, res, next) {
  try {
    let token = req.cookies?.anon_pro_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Professional authorization required.'
      });
    }

    // Verify token was not revoked server-side on logout
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isRevoked = await RevokedToken.findOne({ tokenHash });
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        error: 'Professional session has been logged out and revoked. Please log in again.'
      });
    }

    let secret;
    try {
      secret = getJwtSecret();
    } catch {
      return res.status(500).json({ success: false, error: 'Server authentication configuration error.' });
    }

    let decoded;
    try {
      // algorithms: ['HS256'] prevents algorithm confusion attacks
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired professional token.'
      });
    }

    // Verify token has expected professional role claim
    if (decoded.role !== 'professional') {
      return res.status(403).json({
        success: false,
        error: 'Token is not a professional credential.'
      });
    }

    // Retrieve professional from DB — do not trust the token payload for authorization
    const professional = await ProfessionalAccount.findById(decoded.id).select('-passwordHash');
    if (!professional) {
      return res.status(401).json({
        success: false,
        error: 'Professional account not found.'
      });
    }

    if (professional.verificationStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your professional account has been suspended.'
      });
    }

    req.professional = professional;
    next();
  } catch (error) {
    next(error);
  }
}
