import { AnonymousSession } from '../models/AnonymousSession.js';
import { hashToken } from '../services/identityService.js';

/**
 * Moderator authentication middleware.
 *
 * Moderators must authenticate via the same anonymous-session system as regular
 * users plus an additional server-verified moderator role that is assigned
 * server-side and is NEVER granted through a shared passphrase.
 *
 * A moderator must:
 *   1. Have a valid, active anonymous session.
 *   2. Have their identity's `isModerator` flag set to true in the database by
 *      an administrator (not self-assigned).
 *
 * This replaces the previous shared-passphrase scheme, which was insecure.
 */
export async function requireModeratorAuth(req, res, next) {
  try {
    // Read session token from httpOnly cookie or x-anon-token header
    const rawToken = req.cookies?.anon_session_token || req.headers['x-anon-token'];

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please establish an anonymous session.'
      });
    }

    const tokenHash = hashToken(rawToken);
    const session = await AnonymousSession.findOne({
      tokenHash,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).populate('identity');

    if (!session || !session.identity) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or not found.'
      });
    }

    if (session.identity.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'This identity has been suspended.'
      });
    }

    // Server-side moderator role check — isModerator is set by admin only
    if (!session.identity.isModerator) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Moderator authorization required.'
      });
    }

    // Attach verified moderator identity to request
    req.identity = session.identity;
    req.moderatorId = session.identity._id.toString();
    req.session = session;
    next();
  } catch (err) {
    // Safe error — no sensitive detail disclosure
    return res.status(500).json({
      success: false,
      error: 'Authentication check failed.'
    });
  }
}
