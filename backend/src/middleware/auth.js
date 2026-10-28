import { hashToken } from '../services/identityService.js';
import { AnonymousSession } from '../models/AnonymousSession.js';

export async function requireAnonymousAuth(req, res, next) {
  try {
    const rawToken = req.cookies?.anon_session_token || req.headers['x-anon-token'];

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please create an identity first.'
      });
    }

    const tokenHash = hashToken(rawToken);
    const session = await AnonymousSession.findOne({
      tokenHash,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).populate('identity').populate('identities');

    if (!session || !session.identity) {
      return res.status(401).json({
        success: false,
        error: 'Anonymous session expired or has no active identity. Please create an identity first.'
      });
    }

    if (session.identity.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'This anonymous identity has been suspended due to safety or community violations.',
        reason: session.identity.suspensionReason
      });
    }

    // Ensure session.identities array is populated and contains the active identity
    if (session.identity && (!session.identities || session.identities.length === 0)) {
      session.identities = [session.identity];
      AnonymousSession.updateOne(
        { _id: session._id },
        { $set: { identities: [session.identity._id] } }
      ).catch(() => {});
    }

    // Update last activity asynchronously via atomic update
    AnonymousSession.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    req.session = session;
    req.identity = session.identity;
    req.identities = session.identities;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAnonymousAuth(req, res, next) {
  try {
    const rawToken = req.cookies?.anon_session_token || req.headers['x-anon-token'];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const session = await AnonymousSession.findOne({
        tokenHash,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).populate('identity').populate('identities');

      if (session) {
        req.session = session;
        if (session.identity && session.identity.status !== 'suspended') {
          req.identity = session.identity;
          req.identities = session.identities;
        }
      }
    }
    next();
  } catch (error) {
    next();
  }
}
