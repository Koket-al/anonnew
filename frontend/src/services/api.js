/**
 * Unified API Client for ANON
 * Interacts with backend via Fetch API using credentials (cookies).
 *
 * Security notes:
 * - Anonymous session tokens are held only in memory (not localStorage/sessionStorage).
 *   The authoritative copy is the httpOnly cookie set by the backend.
 *   The in-memory copy is sent as x-anon-token for non-cookie-capable paths and
 *   for Socket.IO auth; it is never persisted to browser storage.
 * - Admin tokens are held only in memory.  The httpOnly cookie is authoritative.
 * - Moderator authentication uses the same anonymous session cookie/token —
 *   the moderator role is verified server-side via the isModerator field on the identity.
 *   No shared passphrase is sent from the client.
 */

// Tokens are strictly server-managed via HttpOnly cookies and never stored in JavaScript memory
export function setAdminToken(token) {}
export function getAdminToken() { return null; }
export function setApiToken(token) {}
export function getApiToken() { return null; }

const CRYPTO_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a cryptographically random string (e.g. "Ab1z4Qt") in browser using Web Crypto API
 */
export function generateClientCryptoCode(length = 7) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += CRYPTO_CHARSET[array[i] % CRYPTO_CHARSET.length];
    }
    return result;
  }
  return Math.random().toString(36).substring(2, 2 + length);
}

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Sends httpOnly cookies
  });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { error: await response.text() };
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ==========================================================================
// Auth & Identity
// ==========================================================================

export async function enterAnonymously() {
  return await request('/auth/enter', { method: 'POST' });
}

export async function getCurrentIdentity() {
  return await request('/auth/me');
}

export async function createAdditionalIdentity(bio = '') {
  return await request('/auth/identities', {
    method: 'POST',
    body: JSON.stringify({ bio })
  });
}

export const createIdentityApi = createAdditionalIdentity;

export async function switchActiveIdentity(identityId) {
  return await request('/auth/switch-identity', {
    method: 'POST',
    body: JSON.stringify({ identityId })
  });
}

export async function deleteIdentity(identityId, { deleteMessages = false } = {}) {
  return await request(`/auth/identities/${identityId}`, {
    method: 'DELETE',
    body: JSON.stringify({ deleteMessages })
  });
}

export async function rotateIdentity() {
  return await request('/auth/rotate', { method: 'POST' });
}

export async function leaveSession() {
  return await request('/auth/leave', { method: 'POST' });
}

// ==========================================================================
// Communities
// ==========================================================================

function buildQuery(params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );
  const query = new URLSearchParams(cleanParams).toString();
  return query ? `?${query}` : '';
}

export async function getCommunities(params = {}) {
  return await request(`/communities${buildQuery(params)}`);
}

export async function getCommunity(identifier) {
  return await request(`/communities/${identifier}`);
}

export async function createCommunity(payload) {
  return await request('/communities', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateCommunity(id, payload) {
  return await request(`/communities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function joinCommunity(id, inviteCode = null) {
  return await request(`/communities/${id}/join`, {
    method: 'POST',
    ...(inviteCode ? { body: JSON.stringify({ inviteCode }) } : {})
  });
}

export async function requestCommunityAccess(id, note = '') {
  return await request(`/communities/${id}/request-access`, {
    method: 'POST',
    body: JSON.stringify({ note })
  });
}

export async function listCommunityJoinRequests(id) {
  return await request(`/communities/${id}/requests`);
}

export async function reviewCommunityJoinRequest(id, requestId, action) {
  return await request(`/communities/${id}/requests/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify({ action })
  });
}

export async function leaveCommunity(id) {
  return await request(`/communities/${id}/leave`, { method: 'POST' });
}

export async function removeCommunityPost(communityId, postId) {
  return await request(`/communities/${communityId}/posts/${postId}`, { method: 'DELETE' });
}

export async function getCommunityMembers(identifier) {
  return await request(`/communities/${identifier}/members`);
}

// ==========================================================================
// Posts & Ask the Crowd
// ==========================================================================

export async function getPosts(params = {}) {
  return await request(`/posts${buildQuery(params)}`);
}

export async function getPost(id) {
  return await request(`/posts/${id}`);
}

export async function createPost(payload) {
  return await request('/posts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createReply(postId, payload) {
  return await request(`/posts/${postId}/replies`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deletePost(postId) {
  return await request(`/posts/${postId}`, {
    method: 'DELETE'
  });
}

export async function deleteReply(replyId) {
  return await request(`/posts/replies/${replyId}`, {
    method: 'DELETE'
  });
}

export async function toggleBeenThroughThis(postId) {
  return await request(`/posts/${postId}/been-through-this`, { method: 'POST' });
}

// ==========================================================================
// Private Messaging
// ==========================================================================

export async function getConversations() {
  return await request('/messages');
}

export async function requestConversation(payload) {
  return await request('/messages/request', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function respondToConversationRequest(convId, action) {
  return await request(`/messages/${convId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action })
  });
}

export async function getMessages(convId) {
  return await request(`/messages/${convId}/messages`);
}

export async function sendMessage(convId, content) {
  return await request(`/messages/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });
}

export async function deleteMessage(messageId) {
  return await request(`/messages/message/${messageId}`, {
    method: 'DELETE'
  });
}

export async function blockUser(payload) {
  return await request('/messages/block', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function closeConversation(convId) {
  return await request(`/messages/${convId}/close`, { method: 'POST' });
}

// ==========================================================================
// Listening Rooms
// ==========================================================================

export async function getListeningRooms() {
  return await request('/listening-rooms');
}

export async function createListeningRoom(payload) {
  return await request('/listening-rooms', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getListeningRoom(id) {
  return await request(`/listening-rooms/${id}`);
}

export async function joinListeningRoom(id) {
  return await request(`/listening-rooms/${id}/join`, { method: 'POST' });
}

export async function leaveListeningRoom(id) {
  return await request(`/listening-rooms/${id}/leave`, { method: 'POST' });
}

export async function closeListeningRoom(id) {
  return await request(`/listening-rooms/${id}/close`, { method: 'POST' });
}

// ==========================================================================
// AI Assistant
// ==========================================================================

export async function getAIStatus() {
  return await request('/ai/status');
}

export async function askAI(message, history = []) {
  return await request('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history })
  });
}

// ==========================================================================
// Verified Professionals
// ==========================================================================

export async function getVerifiedProfessionals(params = {}) {
  return await request(`/professionals/directory${buildQuery(params)}`);
}

export async function submitConsultationRequest(payload) {
  return await request('/professionals/consultations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getMyConsultations() {
  return await request('/professionals/my-consultations');
}

export async function registerProfessional(payload) {
  return await request('/professionals/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function loginProfessional(payload) {
  return await request('/professionals/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function logoutProfessional() {
  return await request('/professionals/logout', {
    method: 'POST'
  });
}

export async function getProfessionalProfile() {
  return await request('/professionals/me');
}

export async function updateProfessionalProfile(payload) {
  return await request('/professionals/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function getProfessionalConsultations() {
  return await request('/professionals/consultations');
}

export async function respondToConsultation(id, response) {
  return await request(`/professionals/consultations/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ response })
  });
}

// ==========================================================================
// Moderation & Platform Safety
// ==========================================================================

export async function submitReport(payload) {
  return await request('/moderation/report', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Moderation endpoints authenticate via the anonymous session cookie/token.
// The backend verifies the isModerator flag on the identity — no shared secret is sent.

export async function getModerationReports(params = {}) {
  return await request(`/moderation/reports${buildQuery(params)}`);
}

export async function resolveModerationReport(id, payload) {
  return await request(`/moderation/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function removeModerationContent(payload) {
  return await request('/moderation/content/remove', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function suspendModerationIdentity(payload) {
  return await request('/moderation/identity/suspend', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPendingProfessionalsModeration() {
  return await request('/moderation/professionals/pending');
}

export async function reviewProfessionalVerificationModeration(id, payload) {
  return await request(`/moderation/professionals/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ==========================================================================
// Admin Dashboard & Clinician Oversight
// ==========================================================================

export async function adminLogin({ email, password }) {
  return await request('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function adminLogout() {
  return await request('/admin/logout', { method: 'POST' });
}

export async function getAdminMe() {
  return await request('/admin/me');
}

export async function getAdminPendingProfessionals() {
  return await request('/admin/professionals/pending');
}

export async function getAdminAllProfessionals(status = 'all') {
  return await request(`/admin/professionals?status=${status}`);
}

export async function reviewProfessionalApplication(id, { decision, notes }) {
  return await request(`/admin/professionals/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes })
  });
}

export async function createDirectProfessional(payload) {
  return await request('/admin/professionals', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminProfessional(id) {
  return await request(`/admin/professionals/${id}`, {
    method: 'DELETE'
  });
}
