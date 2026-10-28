import crypto from 'crypto';
import { AnonymousIdentity } from '../models/AnonymousIdentity.js';
import { AnonymousSession } from '../models/AnonymousSession.js';
import { Post } from '../models/Post.js';
import { Reply } from '../models/Reply.js';
import { Message } from '../models/Message.js';
import { Community } from '../models/Community.js';
import { CommunityMembership } from '../models/CommunityMembership.js';

const CRYPTO_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a cryptographically secure random alphanumeric string
 * Format looks like: "Ab1z4Qt"
 * @param {number} length
 * @returns {string}
 */
export function generateCryptoIdentityCode(length = 7) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CRYPTO_CHARSET[bytes[i] % CRYPTO_CHARSET.length];
  }
  return result;
}

// Backwards-compatible alias for any callers expecting generateRandomUsername
export const generateRandomUsername = generateCryptoIdentityCode;

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a single unique AnonymousIdentity document with a cryptographic code
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function createAnonymousIdentityRecord(options = {}) {
  let username = generateCryptoIdentityCode(7);
  let exists = await AnonymousIdentity.findOne({ username });
  let attempts = 0;
  while (exists && attempts < 25) {
    username = generateCryptoIdentityCode(7);
    exists = await AnonymousIdentity.findOne({ username });
    attempts++;
  }

  const identity = await AnonymousIdentity.create({
    username,
    bio: options.bio || '',
    avatarSeed: crypto.randomBytes(4).toString('hex')
  });

  return identity;
}

/**
 * Creates a brand new Anonymous Identity and Session (first-time visitor entry)
 * @param {Object} options
 * @returns {Promise<{ identity: Object, sessionToken: string, session: Object }>}
 */
export async function createAnonymousIdentityAndSession(options = {}) {
  const identity = await createAnonymousIdentityRecord(options);

  const sessionToken = generateSessionToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

  const session = await AnonymousSession.create({
    tokenHash,
    identity: identity._id,
    identities: [identity._id],
    expiresAt,
    status: 'active'
  });

  return { identity, sessionToken, session };
}

/**
 * Adds an additional cryptographic identity to an existing session (up to 5 max)
 * The newly created identity becomes the active identity while preserving all previous ones.
 * @param {Object} session
 * @param {Object} options
 * @returns {Promise<{ identity: Object, session: Object }>}
 */
export async function addIdentityToSession(session, options = {}) {
  if (!session.identities) {
    session.identities = session.identity ? [session.identity] : [];
  } else {
    session.identities = session.identities.filter(Boolean);
  }

  if (session.identities.length >= 5) {
    const error = new Error('Identity limit reached. You can hold a maximum of 5 identities at a time. Remove an existing identity to create a new one.');
    error.statusCode = 400;
    error.status = 400;
    throw error;
  }

  const newIdentity = await createAnonymousIdentityRecord(options);
  session.identities.push(newIdentity._id);
  session.identity = newIdentity._id;
  session.lastUsedAt = new Date();
  await session.save();

  return { identity: newIdentity, session };
}

/**
 * Switches the active identity of an existing session to another identity owned by the user.
 * All other identities are preserved.
 * @param {Object} session
 * @param {string|ObjectId} targetIdentityId
 * @returns {Promise<Object>}
 */
export async function switchSessionIdentity(session, targetIdentityId) {
  if (!session.identities || session.identities.length === 0) {
    session.identities = [session.identity];
  }

  const ownsIdentity = session.identities.some(
    id => (id._id || id).toString() === targetIdentityId.toString()
  );

  if (!ownsIdentity) {
    const error = new Error('You do not own this identity.');
    error.status = 403;
    throw error;
  }

  const targetIdentity = await AnonymousIdentity.findById(targetIdentityId);
  if (!targetIdentity) {
    const error = new Error('Identity not found.');
    error.status = 404;
    throw error;
  }

  if (targetIdentity.status === 'suspended') {
    const error = new Error('This anonymous identity has been suspended.');
    error.status = 403;
    throw error;
  }

  session.identity = targetIdentity._id;
  session.lastUsedAt = new Date();
  await session.save();

  return targetIdentity;
}

/**
 * Consciously removes an identity from the user's session.
 * Allows user to either leave messages for others or delete all associated messages/posts.
 * @param {Object} session
 * @param {string|ObjectId} targetIdentityId
 * @param {Object} options { deleteMessages: boolean }
 * @returns {Promise<{ activeIdentity: Object, remainingCount: number }>}
 */
export async function removeIdentityFromSession(session, targetIdentityId, { deleteMessages = false } = {}) {
  if (!session.identities || session.identities.length === 0) {
    session.identities = [session.identity];
  }

  const ownsIdentity = session.identities.some(
    id => (id._id || id).toString() === targetIdentityId.toString()
  );

  if (!ownsIdentity) {
    const error = new Error('You do not own this identity.');
    error.status = 403;
    throw error;
  }

  // Handle messages authored by this identity based on user's conscious decision
  if (deleteMessages) {
    // Collect communities with posts authored by this identity to update postCount
    const postsWithCommunities = await Post.find({
      author: targetIdentityId,
      community: { $exists: true, $ne: null }
    }).select('community');
    const affectedPostCommunityIds = [...new Set(postsWithCommunities.map(p => p.community.toString()))];

    // 1. Soft-delete all posts authored by this identity
    await Post.updateMany(
      { author: targetIdentityId },
      { $set: { isDeleted: true, deletedReason: 'Author consciously removed identity and purged content' } }
    );
    // 2. Soft-delete all replies authored by this identity
    await Reply.updateMany(
      { author: targetIdentityId },
      { $set: { isDeleted: true } }
    );
    // 3. Purge content of private messages sent by this identity
    await Message.updateMany(
      { sender: targetIdentityId },
      { $set: { content: '[Message deleted by author upon identity removal]' } }
    );

    // Recalculate postCount for any affected communities
    for (const commId of affectedPostCommunityIds) {
      const activePostCount = await Post.countDocuments({ community: commId, isDeleted: false });
      await Community.findByIdAndUpdate(commId, { postCount: activePostCount });
    }
  }
  // If deleteMessages is false, all posts, replies, and messages remain intact for others to read!

  // 4. Remove this identity from any communities they joined and update memberCount
  const memberships = await CommunityMembership.find({ identity: targetIdentityId });
  if (memberships.length > 0) {
    const communityIds = [...new Set(memberships.map(m => m.community.toString()))];
    await CommunityMembership.deleteMany({ identity: targetIdentityId });

    for (const commId of communityIds) {
      const actualMemberCount = await CommunityMembership.countDocuments({ community: commId });
      await Community.findByIdAndUpdate(commId, { memberCount: actualMemberCount });
    }
  }

  // Remove target identity from the session's identities pool
  session.identities = session.identities.filter(
    id => (id._id || id).toString() !== targetIdentityId.toString()
  );

  // Permanently remove the identity document
  await AnonymousIdentity.findByIdAndDelete(targetIdentityId);

  // If the removed identity was the active one, assign another active identity
  let newActiveIdentity = null;
  if (session.identities.length > 0) {
    session.identity = session.identities[0];
    newActiveIdentity = await AnonymousIdentity.findById(session.identity);
  } else {
    // User deleted their only identity: do NOT automatically create a new identity.
    // Identity will only be assigned when user explicitly creates an identity.
    session.identity = null;
    newActiveIdentity = null;
  }

  session.lastUsedAt = new Date();
  await session.save();

  return {
    activeIdentity: newActiveIdentity,
    remainingCount: session.identities.length
  };
}

/**
 * Creates a new identity within the user's session without revoking existing identities (up to 5 max).
 * If the user already has 5 identities, an error is returned.
 */
export async function rotateAnonymousIdentity(currentSession) {
  if (currentSession) {
    return await addIdentityToSession(currentSession);
  }
  return await createAnonymousIdentityAndSession();
}
