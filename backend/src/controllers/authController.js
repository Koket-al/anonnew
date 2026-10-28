import {
  createAnonymousIdentityAndSession,
  addIdentityToSession,
  switchSessionIdentity,
  removeIdentityFromSession,
  hashToken
} from '../services/identityService.js';
import { AnonymousSession } from '../models/AnonymousSession.js';

const COOKIE_NAME = 'anon_session_token';

function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 24 * 60 * 60 * 1000 // 60 days
  });
}

export async function enterAnonymously(req, res, next) {
  try {
    const isExplicitApiClient = req.headers['x-api-client'] === 'true';
    const rawToken = req.cookies?.anon_session_token || req.headers['x-anon-token'];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const existingSession = await AnonymousSession.findOne({
        tokenHash,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).populate('identity').populate('identities');

      if (existingSession && existingSession.identity && existingSession.identity.status !== 'suspended') {
        const identities = (existingSession.identities || []).map(id => ({
          id: id._id,
          username: id.username,
          avatarSeed: id.avatarSeed,
          createdAt: id.createdAt,
          isCurrent: id._id.toString() === existingSession.identity._id.toString()
        }));

        setSessionCookie(res, rawToken);

        return res.json({
          success: true,
          identity: {
            id: existingSession.identity._id,
            username: existingSession.identity.username,
            avatarSeed: existingSession.identity.avatarSeed,
            createdAt: existingSession.identity.createdAt
          },
          identities,
          maxIdentities: 5,
          ...(isExplicitApiClient ? { token: rawToken } : {}),
          message: 'Active anonymous session reconnected.'
        });
      }
    }

    const { identity, sessionToken } = await createAnonymousIdentityAndSession();
    setSessionCookie(res, sessionToken);

    res.status(201).json({
      success: true,
      identity: {
        id: identity._id,
        username: identity.username,
        avatarSeed: identity.avatarSeed,
        createdAt: identity.createdAt
      },
      identities: [
        {
          id: identity._id,
          username: identity.username,
          avatarSeed: identity.avatarSeed,
          createdAt: identity.createdAt,
          isCurrent: true
        }
      ],
      maxIdentities: 5,
      canCreateMore: true,
      ...(isExplicitApiClient ? { token: sessionToken } : {}),
      message: 'Anonymous cryptographic identity created successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentIdentity(req, res, next) {
  try {
    if (!req.identity || !req.session) {
      return res.json({
        success: true,
        identity: null,
        identities: [],
        maxIdentities: 5,
        canCreateMore: true
      });
    }

    const currentIdStr = req.identity._id.toString();
    const identities = (req.session.identities || []).filter(Boolean).map(id => ({
      id: id._id,
      username: id.username,
      avatarSeed: id.avatarSeed,
      createdAt: id.createdAt,
      isCurrent: id._id.toString() === currentIdStr
    }));

    res.json({
      success: true,
      identity: {
        id: req.identity._id,
        username: req.identity.username,
        avatarSeed: req.identity.avatarSeed,
        bio: req.identity.bio,
        createdAt: req.identity.createdAt,
        status: req.identity.status
      },
      identities,
      maxIdentities: 5,
      canCreateMore: identities.length < 5
    });
  } catch (error) {
    next(error);
  }
}

export async function createAdditionalIdentity(req, res, next) {
  try {
    const isExplicitApiClient = req.headers['x-api-client'] === 'true';
    const { bio } = req.body || {};
    let session = req.session;

    if (!session) {
      const rawToken = req.cookies?.anon_session_token || req.headers['x-anon-token'];
      if (rawToken) {
        const tokenHash = hashToken(rawToken);
        session = await AnonymousSession.findOne({
          tokenHash,
          status: 'active',
          expiresAt: { $gt: new Date() }
        }).populate('identities');
      }
    }

    if (!session) {
      // First identity creation by user
      const { identity, sessionToken } = await createAnonymousIdentityAndSession({ bio });
      setSessionCookie(res, sessionToken);

      return res.status(201).json({
        success: true,
        identity: {
          id: identity._id,
          username: identity.username,
          avatarSeed: identity.avatarSeed,
          bio: identity.bio,
          createdAt: identity.createdAt
        },
        identities: [
          {
            id: identity._id,
            username: identity.username,
            avatarSeed: identity.avatarSeed,
            createdAt: identity.createdAt,
            isCurrent: true
          }
        ],
        maxIdentities: 5,
        canCreateMore: true,
        ...(isExplicitApiClient ? { token: sessionToken } : {}),
        message: `Cryptographic identity ${identity.username} created successfully.`
      });
    }

    const { identity } = await addIdentityToSession(session, { bio });
    await session.populate('identities');

    const currentIdStr = identity._id.toString();
    const identities = (session.identities || []).filter(Boolean).map(id => ({
      id: id._id,
      username: id.username,
      avatarSeed: id.avatarSeed,
      createdAt: id.createdAt,
      isCurrent: id._id.toString() === currentIdStr
    }));

    res.status(201).json({
      success: true,
      identity: {
        id: identity._id,
        username: identity.username,
        avatarSeed: identity.avatarSeed,
        bio: identity.bio,
        createdAt: identity.createdAt
      },
      identities,
      maxIdentities: 5,
      canCreateMore: identities.length < 5,
      ...(isExplicitApiClient ? { token: req.cookies?.anon_session_token || req.headers['x-anon-token'] } : {}),
      message: `New cryptographic identity ${identity.username} created. You now hold ${identities.length} of 5 identities.`
    });
  } catch (error) {
    next(error);
  }
}

export async function switchActiveIdentity(req, res, next) {
  try {
    const { identityId } = req.body;
    if (!identityId) {
      return res.status(400).json({ success: false, error: 'identityId is required to switch identity.' });
    }

    const switchedIdentity = await switchSessionIdentity(req.session, identityId);
    await req.session.populate('identities');

    const currentIdStr = switchedIdentity._id.toString();
    const identities = (req.session.identities || []).map(id => ({
      id: id._id,
      username: id.username,
      avatarSeed: id.avatarSeed,
      createdAt: id.createdAt,
      isCurrent: id._id.toString() === currentIdStr
    }));

    res.json({
      success: true,
      identity: {
        id: switchedIdentity._id,
        username: switchedIdentity.username,
        avatarSeed: switchedIdentity.avatarSeed,
        createdAt: switchedIdentity.createdAt
      },
      identities,
      maxIdentities: 5,
      canCreateMore: identities.length < 5,
      message: `Active identity switched to ${switchedIdentity.username}. All your other identities remain intact.`
    });
  } catch (error) {
    next(error);
  }
}

export async function removeIdentity(req, res, next) {
  try {
    const { id } = req.params;
    const { deleteMessages = false } = req.body || {};

    const result = await removeIdentityFromSession(req.session, id, { deleteMessages: Boolean(deleteMessages) });
    await req.session.populate('identities');

    // Revoke any active socket rooms for the removed identity
    const io = req.app.get('io');
    if (io) {
      const userSockets = io.sockets.adapter.rooms.get(`user:${id}`);
      if (userSockets) {
        for (const socketId of userSockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s) {
            s.emit('identity_revoked', { identityId: id });
            s.disconnect(true);
          }
        }
      }
    }

    const currentIdStr = result.activeIdentity ? result.activeIdentity._id.toString() : '';
    const identities = (req.session.identities || []).map(ident => ({
      id: ident._id,
      username: ident.username,
      avatarSeed: ident.avatarSeed,
      createdAt: ident.createdAt,
      isCurrent: ident._id.toString() === currentIdStr
    }));

    res.json({
      success: true,
      identity: result.activeIdentity ? {
        id: result.activeIdentity._id,
        username: result.activeIdentity.username,
        avatarSeed: result.activeIdentity.avatarSeed,
        createdAt: result.activeIdentity.createdAt
      } : null,
      identities,
      maxIdentities: 5,
      canCreateMore: identities.length < 5,
      message: `Identity consciously removed. ${deleteMessages ? 'All questions and messages by this identity were permanently purged.' : 'Your questions and messages were preserved for the community.'}`
    });
  } catch (error) {
    next(error);
  }
}

export async function newIdentity(req, res, next) {
  try {
    const { identity } = await addIdentityToSession(req.session);
    await req.session.populate('identities');

    const currentIdStr = identity._id.toString();
    const identities = (req.session.identities || []).map(id => ({
      id: id._id,
      username: id.username,
      avatarSeed: id.avatarSeed,
      createdAt: id.createdAt,
      isCurrent: id._id.toString() === currentIdStr
    }));

    res.json({
      success: true,
      identity: {
        id: identity._id,
        username: identity.username,
        avatarSeed: identity.avatarSeed,
        createdAt: identity.createdAt
      },
      identities,
      maxIdentities: 5,
      canCreateMore: identities.length < 5,
      message: `New cryptographic identity created. Previous identities are preserved.`
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveSession(req, res, next) {
  try {
    if (req.session) {
      req.session.status = 'revoked';
      await req.session.save();
    }
    res.clearCookie(COOKIE_NAME);
    res.json({
      success: true,
      message: 'Session ended and anonymous credential revoked.'
    });
  } catch (error) {
    next(error);
  }
}
