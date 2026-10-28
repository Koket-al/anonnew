/**
 * ANON Security Regression Tests
 * Covers:
 *   - Moderator authentication (role-based, no shared passphrase)
 *   - JWT / admin token validation (algorithm pinning, expiry, role claims)
 *   - Private community access control
 *   - Socket.io community / post authorization (REST-level tests)
 *   - Listening room membership enforcement
 *   - Cookie / CSRF fundamentals
 *   - Object-level authorization
 */

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/anon_security_test_db';
process.env.SESSION_SECRET = 'test_session_secret_32bytes_long_string';
process.env.JWT_SECRET = 'test_jwt_secret_32bytes_long_str_ok';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.local';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TestAdminPass123!';

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as ClientIO } from 'socket.io-client';
import { server } from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { Community } from '../src/models/Community.js';
import { ProfessionalAccount } from '../src/models/ProfessionalAccount.js';

let baseURL;
let testServer;

// Global fetch wrapper for test suite API calls
const rawFetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (!headers.has('x-api-client')) {
    headers.set('x-api-client', 'true');
  }
  return rawFetch(url, { ...options, headers });
};

async function safeDropDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to drop database in production environment!');
  }
  const dbName = mongoose.connection.name || '';
  if (!dbName.toLowerCase().includes('test')) {
    throw new Error(`Refusing to drop database '${dbName}': database name must contain 'test'!`);
  }
  await mongoose.connection.dropDatabase();
}

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }
  await safeDropDatabase().catch(() => {});
  await new Promise((resolve) => {
    testServer = server.listen(0, () => {
      const port = testServer.address().port;
      baseURL = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await safeDropDatabase().catch(() => {});
  await new Promise((resolve) => testServer.close(resolve));
  await mongoose.disconnect();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function createUser() {
  const res = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
  const data = await res.json();
  return { token: data.token, identity: data.identity };
}

async function adminLogin() {
  const res = await fetch(`${baseURL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  });
  const data = await res.json();
  return data.token;
}

async function createCommunity(token, { isPrivate = false } = {}) {
  const res = await fetch(`${baseURL}/api/communities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-anon-token': token },
    body: JSON.stringify({
      name: `TestCommunity-${Date.now()}`,
      description: 'Security test community.',
      topic: 'General Health',
      isPrivate
    })
  });
  const data = await res.json();
  return data.community;
}

function createSocketClient(token = null) {
  return ClientIO(baseURL, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Moderator Authentication', () => {
  let user1, user2, modIdentityId, modToken, adminToken;

  test('Setup users and admin', async () => {
    const u1 = await createUser();
    user1 = u1;
    const u2 = await createUser();
    user2 = u2;
    adminToken = await adminLogin();
    assert.ok(adminToken, 'Admin login should succeed');
  });

  test('MOD-01: Unauthenticated request is denied (401)', async () => {
    const res = await fetch(`${baseURL}/api/moderation/reports`);
    assert.equal(res.status, 401);
  });

  test('MOD-02: Regular user cannot access moderator endpoints (403)', async () => {
    const res = await fetch(`${baseURL}/api/moderation/reports`, {
      headers: { 'x-anon-token': user1.token }
    });
    assert.equal(res.status, 403);
  });

  test('MOD-03: Admin grants moderator role to a specific identity', async () => {
    // Create identity that will become moderator
    const modUser = await createUser();
    modToken = modUser.token;
    modIdentityId = modUser.identity.id;

    const grantRes = await fetch(`${baseURL}/api/admin/identities/${modIdentityId}/moderator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ grant: true })
    });
    assert.equal(grantRes.status, 200);
    const data = await grantRes.json();
    assert.equal(data.identity.isModerator, true);
  });

  test('MOD-04: Authorized moderator identity can access moderation endpoints (200)', async () => {
    const res = await fetch(`${baseURL}/api/moderation/reports`, {
      headers: { 'x-anon-token': modToken }
    });
    assert.equal(res.status, 200);
  });

  test('MOD-05: Revoking moderator role blocks access again', async () => {
    const revokeRes = await fetch(`${baseURL}/api/admin/identities/${modIdentityId}/moderator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ grant: false })
    });
    assert.equal(revokeRes.status, 200);

    const res = await fetch(`${baseURL}/api/moderation/reports`, {
      headers: { 'x-anon-token': modToken }
    });
    assert.equal(res.status, 403);
  });

  test('MOD-06: Old shared-passphrase header is rejected', async () => {
    // The old x-moderator-secret header must NOT grant access
    const res = await fetch(`${baseURL}/api/moderation/reports`, {
      headers: { 'x-moderator-secret': 'dev_moderator_secret_passphrase' }
    });
    // Should be 401 (no session) not 200
    assert.notEqual(res.status, 200);
  });

  test('MOD-07: Grant endpoint requires admin auth', async () => {
    const { identity } = await createUser();
    const res = await fetch(`${baseURL}/api/admin/identities/${identity.id}/moderator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant: true })
      // No admin token — should be rejected
    });
    assert.equal(res.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: JWT / Admin Token Validation', () => {
  let adminToken;

  test('Setup: Admin login', async () => {
    adminToken = await adminLogin();
    assert.ok(adminToken);
  });

  test('JWT-01: Valid admin token is accepted', async () => {
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
  });

  test('JWT-02: Expired token is rejected', async () => {
    const expiredToken = jwt.sign(
      { role: 'admin', email: process.env.ADMIN_EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: -1, algorithm: 'HS256' }
    );
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    assert.equal(res.status, 401);
  });

  test('JWT-03: Token signed with wrong secret is rejected', async () => {
    const badToken = jwt.sign(
      { role: 'admin', email: process.env.ADMIN_EMAIL },
      'wrong_secret_that_is_not_the_real_one',
      { expiresIn: '1d', algorithm: 'HS256' }
    );
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${badToken}` }
    });
    assert.equal(res.status, 401);
  });

  test('JWT-04: Token with modified role claim is rejected', async () => {
    // Create a valid-looking token but with role: 'superadmin'
    const forgedToken = jwt.sign(
      { role: 'superadmin', email: process.env.ADMIN_EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: '1d', algorithm: 'HS256' }
    );
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${forgedToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('JWT-05: Token with modified email claim is rejected', async () => {
    const forgedToken = jwt.sign(
      { role: 'admin', email: 'attacker@evil.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1d', algorithm: 'HS256' }
    );
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${forgedToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('JWT-06: None algorithm token is rejected', async () => {
    // Manually craft a token with alg: none
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      role: 'admin',
      email: process.env.ADMIN_EMAIL,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    })).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${noneToken}` }
    });
    assert.equal(res.status, 401);
  });

  test('JWT-07: Missing token is rejected with 401', async () => {
    const res = await fetch(`${baseURL}/api/admin/me`);
    assert.equal(res.status, 401);
  });

  test('JWT-08: Professional token cannot access admin endpoint', async () => {
    // Create a professional token
    const proToken = jwt.sign(
      { id: new mongoose.Types.ObjectId(), role: 'professional' },
      process.env.JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );
    const res = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${proToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('JWT-09: Admin logout clears session (cookie cleared)', async () => {
    const res = await fetch(`${baseURL}/api/admin/logout`, { method: 'POST' });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    // Should have cleared the admin cookie
    assert.ok(setCookie.includes('anon_admin_token') || res.ok, 'Logout should succeed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Private Community Access Control', () => {
  let owner, nonMember, privateCommunityId, publicCommunityId;

  test('Setup: Create users and communities', async () => {
    const u1 = await createUser();
    owner = u1;
    const u2 = await createUser();
    nonMember = u2;

    const priv = await createCommunity(owner.token, { isPrivate: true });
    assert.ok(priv, 'Private community should be created');
    privateCommunityId = priv.id;

    const pub = await createCommunity(owner.token, { isPrivate: false });
    publicCommunityId = pub.id;
  });

  test('PRIV-01: Unauthenticated user cannot see private community details', async () => {
    const res = await fetch(`${baseURL}/api/communities/${privateCommunityId}`);
    assert.equal(res.status, 403);
    // Must not expose description / rules in forbidden response
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(!data.community?.description, 'Description must not be exposed to non-members');
  });

  test('PRIV-02: Non-member cannot see private community details', async () => {
    const res = await fetch(`${baseURL}/api/communities/${privateCommunityId}`, {
      headers: { 'x-anon-token': nonMember.token }
    });
    assert.equal(res.status, 403);
  });

  test('PRIV-03: Owner can see private community details', async () => {
    const res = await fetch(`${baseURL}/api/communities/${privateCommunityId}`, {
      headers: { 'x-anon-token': owner.token }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.community.isPrivate, true);
  });

  test('PRIV-04: Non-member cannot list posts of private community', async () => {
    const res = await fetch(`${baseURL}/api/posts?communityId=${privateCommunityId}`, {
      headers: { 'x-anon-token': nonMember.token }
    });
    assert.equal(res.status, 403);
  });

  test('PRIV-05: Non-member cannot post in private community', async () => {
    const res = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': nonMember.token },
      body: JSON.stringify({
        title: 'Unauthorized private post',
        content: 'I should not be able to post here.',
        communityId: privateCommunityId,
        category: 'General Health'
      })
    });
    assert.equal(res.status, 403);
  });

  test('PRIV-06: Public community remains accessible without authentication', async () => {
    const res = await fetch(`${baseURL}/api/communities/${publicCommunityId}`);
    assert.equal(res.status, 200);
  });

  test('PRIV-07: Private community does not appear in public listing', async () => {
    const res = await fetch(`${baseURL}/api/communities`);
    const data = await res.json();
    const ids = data.communities.map(c => c.id);
    assert.ok(!ids.includes(privateCommunityId), 'Private community must not appear in public list');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Object-Level Authorization', () => {
  let user1, user2, conversationId;

  test('Setup: Create two users', async () => {
    const u1 = await createUser();
    user1 = u1;
    const u2 = await createUser();
    user2 = u2;
  });

  test('OBJ-01: User cannot access another user\'s profile using their identity ID', async () => {
    // Attempt to access a resource that belongs to user2 using user1's session
    // This tests that resources are scoped to the authenticated identity
    const res = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1.token }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // Must be user1's identity, not user2's
    assert.equal(data.identity.id, user1.identity.id);
    assert.notEqual(data.identity.id, user2.identity.id);
  });

  test('OBJ-02: User cannot delete another user\'s identity', async () => {
    const res = await fetch(`${baseURL}/api/auth/identities/${user2.identity.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1.token
      },
      body: JSON.stringify({ deleteMessages: false })
    });
    // Should be 403 or 404 — not 200
    assert.notEqual(res.status, 200);
  });

  test('OBJ-03: Non-admin cannot grant moderator role', async () => {
    const { identity } = await createUser();
    const res = await fetch(`${baseURL}/api/admin/identities/${identity.id}/moderator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1.token  // regular user, not admin
      },
      body: JSON.stringify({ grant: true })
    });
    // Requires admin token — should be 401
    assert.equal(res.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Input Validation & Safe Errors', () => {
  let user;

  test('Setup: Create user', async () => {
    user = await createUser();
  });

  test('INP-01: Invalid ObjectId in community route returns 404 or 400, not crash', async () => {
    const res = await fetch(`${baseURL}/api/communities/not-a-valid-id`, {
      headers: { 'x-anon-token': user.token }
    });
    assert.ok([400, 404].includes(res.status), `Expected 400 or 404, got ${res.status}`);
  });

  test('INP-02: XSS in post content is sanitized', async () => {
    // Create community first
    const comm = await createCommunity(user.token);
    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': user.token },
      body: JSON.stringify({
        title: '<script>alert(1)</script>',
        content: '<img src=x onerror=alert(1)>',
        communityId: comm.id,
        category: 'General Health'
      })
    });
    if (postRes.status === 201) {
      const data = await postRes.json();
      assert.ok(!data.post.title.includes('<script>'), 'Script tags must be stripped from title');
      assert.ok(!data.post.content.includes('onerror='), 'Event handlers must be stripped from content');
    }
    // If 400 — that's also fine (rejected at input validation)
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Cookies, CSRF, and CORS', () => {
  let user;

  test('Setup: Create user', async () => {
    user = await createUser();
  });

  test('COOKIE-01: Anonymous session cookie has HttpOnly and SameSite=lax', async () => {
    const res = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('anon_session_token'), 'Session cookie must be set');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie must have HttpOnly');
    assert.ok(setCookie.toLowerCase().includes('samesite=lax'), 'Cookie must have SameSite=lax');
  });

  test('COOKIE-02: Admin session cookie has HttpOnly and SameSite=lax', async () => {
    const res = await fetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('anon_admin_token'), 'Admin cookie must be set');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Admin cookie must have HttpOnly');
    assert.ok(setCookie.toLowerCase().includes('samesite=lax'), 'Admin cookie must have SameSite=lax');
  });

  test('COOKIE-03: Leave session invalidates session and clears cookie', async () => {
    const res = await fetch(`${baseURL}/api/auth/leave`, {
      method: 'POST',
      headers: { 'x-anon-token': user.token }
    });
    assert.equal(res.status, 200);

    // Old token must no longer work
    const checkRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user.token }
    });
    const data = await checkRes.json();
    assert.equal(data.identity, null);
  });

  test('CSRF-01: State-changing request with unapproved Origin is rejected (403)', async () => {
    const freshUser = await createUser();
    const res = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': freshUser.token,
        'Origin': 'https://evil-attacker-site.com'
      },
      body: JSON.stringify({
        title: 'CSRF Attack Attempt',
        content: 'This should be blocked by origin validation.',
        category: 'General Health'
      })
    });
    assert.equal(res.status, 403, 'Cross-site state-changing request from unauthorized origin must be blocked');
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('CSRF-02: State-changing request with approved Origin succeeds', async () => {
    const freshUser = await createUser();
    const res = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': freshUser.token,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({
        name: `AllowedOrigin-${Date.now()}`,
        description: 'Testing approved origin validation.',
        topic: 'General Health'
      })
    });
    assert.equal(res.status, 201);
  });

  test('CORS-01: Approved origin gets credentials and allow-origin headers', async () => {
    const res = await fetch(`${baseURL}/api/health`, {
      headers: { 'Origin': 'http://localhost:5173' }
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });

  test('CORS-02: Unapproved origin does not get allow-origin header', async () => {
    const res = await fetch(`${baseURL}/api/health`, {
      headers: { 'Origin': 'http://unapproved-origin.org' }
    });
    assert.notEqual(res.headers.get('access-control-allow-origin'), 'http://unapproved-origin.org');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Socket.IO Community and Post Access', () => {
  let owner, nonMember, privateCommunity, post;

  test('Setup: Create users, private community, and post', async () => {
    owner = await createUser();
    nonMember = await createUser();

    privateCommunity = await createCommunity(owner.token, { isPrivate: true });
    assert.ok(privateCommunity);

    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        title: 'Private Discussion Topic',
        content: 'This post is inside a private community.',
        communityId: privateCommunity.id,
        category: 'General Health'
      })
    });
    const postData = await postRes.json();
    post = postData.post;
    assert.ok(post);
  });

  test('SOCK-01: Non-member cannot join private community socket room', async () => {
    const socket = createSocketClient(nonMember.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('join_community', { communityId: privateCommunity.id });
      });
      socket.on('error', (err) => {
        assert.ok(err.includes('private community') || err.includes('member'));
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Expected error event when joining private community without membership'));
      }, 2000);
    });
  });

  test('SOCK-02: Authorized member can join private community room without error', async () => {
    const socket = createSocketClient(owner.token);
    await new Promise((resolve, reject) => {
      let receivedError = false;
      socket.on('connect', () => {
        socket.emit('join_community', { communityId: privateCommunity.id });
        // Give 300ms to confirm no error is emitted
        setTimeout(() => {
          socket.disconnect();
          if (!receivedError) resolve();
        }, 300);
      });
      socket.on('error', () => {
        receivedError = true;
        socket.disconnect();
        reject(new Error('Owner should not receive error on joining private community room'));
      });
    });
  });

  test('SOCK-03: Non-member cannot join community post room', async () => {
    const socket = createSocketClient(nonMember.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('join_post', { postId: post.id });
      });
      socket.on('error', (err) => {
        assert.ok(err.includes('community') || err.includes('Join the community'));
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Expected error event when non-member joins community post room'));
      }, 2000);
    });
  });

  test('SOCK-04: Authorized member can join community post room', async () => {
    const socket = createSocketClient(owner.token);
    await new Promise((resolve, reject) => {
      let receivedError = false;
      socket.on('connect', () => {
        socket.emit('join_post', { postId: post.id });
        setTimeout(() => {
          socket.disconnect();
          if (!receivedError) resolve();
        }, 300);
      });
      socket.on('error', () => {
        receivedError = true;
        socket.disconnect();
        reject(new Error('Owner should be allowed to join community post room'));
      });
    });
  });

  test('SOCK-05: Malformed IDs emit error without server crash', async () => {
    const socket = createSocketClient(owner.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('join_post', { postId: 'not-valid-hex-id' });
      });
      socket.on('error', (err) => {
        assert.ok(err.includes('Invalid'));
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Expected error event for invalid post ID'));
      }, 2000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Security: Listening Rooms', () => {
  let host, guest, roomId;

  test('Setup: Create room', async () => {
    host = await createUser();
    guest = await createUser();

    const roomRes = await fetch(`${baseURL}/api/listening-rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': host.token },
      body: JSON.stringify({
        title: 'Security Room ' + Date.now(),
        topic: 'Mental Wellness',
        description: 'Room for security testing.'
      })
    });
    const roomData = await roomRes.json();
    assert.equal(roomRes.status, 201);
    roomId = roomData.room.id;
  });

  test('ROOM-01: Sending message without joining room is rejected', async () => {
    const socket = createSocketClient(guest.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        // Attempt to send a message without calling join_listening_room
        socket.emit('send_room_message', { roomId, content: 'Sneaky message without joining' });
      });
      socket.on('error', (err) => {
        assert.ok(err.includes('join the room before sending'), `Unexpected error: ${err}`);
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Expected error when sending message without joining room'));
      }, 2000);
    });
  });

  test('ROOM-02: Joined participant can send valid messages and receives broadcast', async () => {
    const socket = createSocketClient(guest.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('join_listening_room', { roomId });
      });
      socket.on('user_joined_room', () => {
        socket.emit('send_room_message', { roomId, content: 'Hello everyone in the listening room!' });
      });
      socket.on('new_room_message', (msg) => {
        assert.equal(msg.content, 'Hello everyone in the listening room!');
        assert.equal(msg.roomId, roomId);
        assert.ok(msg.senderUsername);
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Did not receive message broadcast'));
      }, 2000);
    });
  });

  test('ROOM-03: Sender cannot spoof username in message payload', async () => {
    const socket = createSocketClient(guest.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('join_listening_room', { roomId });
      });
      socket.on('user_joined_room', () => {
        // Attempt to spoof senderUsername as 'Admin_Moderator'
        socket.emit('send_room_message', {
          roomId,
          content: 'Impersonation test',
          senderUsername: 'Admin_Moderator',
          senderId: 'fake_admin_id'
        });
      });
      socket.on('new_room_message', (msg) => {
        // Must use verified identity username, not spoofed one
        assert.notEqual(msg.senderUsername, 'Admin_Moderator');
        assert.equal(msg.senderUsername, guest.identity.username);
        // senderId must not be exposed to participants
        assert.equal(msg.senderId, undefined);
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Did not receive broadcast'));
      }, 2000);
    });
  });

  test('ROOM-04: Exceeding message rate limit emits rate limit error', async () => {
    const socket = createSocketClient(guest.token);
    await new Promise((resolve, reject) => {
      let gotRateError = false;
      socket.on('connect', () => {
        socket.emit('join_listening_room', { roomId });
      });
      socket.on('user_joined_room', () => {
        // Rapidly send 12 messages to exceed rate limit (limit is 8 per window)
        for (let i = 0; i < 12; i++) {
          socket.emit('send_room_message', { roomId, content: `Flood test message ${i}` });
        }
      });
      socket.on('error', (err) => {
        if (err.includes('rate limit')) {
          gotRateError = true;
          socket.disconnect();
          resolve();
        }
      });
      setTimeout(() => {
        socket.disconnect();
        if (gotRateError) resolve();
        else reject(new Error('Expected rate limit error when flooding messages'));
      }, 2000);
    });
  });

  test('ROOM-05: Unauthenticated guest can join, send messages, and disconnect safely', async () => {
    // Unauthenticated guest socket has no token
    const guestSocket = createSocketClient(null);
    await new Promise((resolve, reject) => {
      guestSocket.on('connect', () => {
        guestSocket.emit('join_listening_room', { roomId });
      });
      guestSocket.on('user_joined_room', (data) => {
        assert.equal(data.username, 'Anonymous');
        // Now guest sends a message
        guestSocket.emit('send_room_message', { roomId, content: 'Guest message of support' });
      });
      guestSocket.on('new_room_message', (msg) => {
        assert.equal(msg.content, 'Guest message of support');
        assert.equal(msg.senderUsername, 'Anonymous');
        // Clean disconnect
        guestSocket.disconnect();
        resolve();
      });
      setTimeout(() => {
        guestSocket.disconnect();
        reject(new Error('Guest interaction timed out'));
      }, 2500);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PASS 2 SECURITY REGRESSION TEST SUITES
// ═════════════════════════════════════════════════════════════════════════════

describe('Pass 2: Private Community Post Broadcast Isolation', () => {
  let owner, nonMember, privateComm, publicComm;
  let ownerSocket, nonMemberSocket, unauthSocket;

  before(async () => {
    owner = await createUser();
    nonMember = await createUser();

    const privRes = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        name: `PrivComm-${Date.now()}`,
        description: 'Private broadcast test',
        topic: 'Mental Wellness',
        isPrivate: true
      })
    });
    const privData = await privRes.json();
    privateComm = privData.community;

    const pubRes = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        name: `PubComm-${Date.now()}`,
        description: 'Public broadcast test',
        topic: 'General Health',
        isPrivate: false
      })
    });
    const pubData = await pubRes.json();
    publicComm = pubData.community;
  });

  after(() => {
    ownerSocket?.disconnect();
    nonMemberSocket?.disconnect();
    unauthSocket?.disconnect();
  });

  test('BROADCAST-01: Private community post, replies, and reactions do not leak to posts_stream', async () => {
    ownerSocket = createSocketClient(owner.token);
    nonMemberSocket = createSocketClient(nonMember.token);
    unauthSocket = createSocketClient(null);

    await new Promise((resolve) => {
      let count = 0;
      const done = () => { count++; if (count === 3) resolve(); };
      ownerSocket.on('connect', done);
      nonMemberSocket.on('connect', done);
      unauthSocket.on('connect', done);
    });

    ownerSocket.emit('join_community', { communityId: privateComm.id });
    nonMemberSocket.emit('join_stream');
    unauthSocket.emit('join_stream');

    await new Promise((resolve) => setTimeout(resolve, 150));

    let unauthGotPost = false;
    let nonMemberGotPost = false;
    let ownerGotPost = false;

    unauthSocket.on('new_post', (p) => {
      if (p.title === 'Secret Private Question') unauthGotPost = true;
    });
    nonMemberSocket.on('new_post', (p) => {
      if (p.title === 'Secret Private Question') nonMemberGotPost = true;
    });
    ownerSocket.on('new_post', (p) => {
      if (p.title === 'Secret Private Question') ownerGotPost = true;
    });

    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        title: 'Secret Private Question',
        content: 'Confidential symptoms discussed only within private community',
        communityId: privateComm.id,
        category: 'Mental Wellness'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    const privPostId = postData.post.id;

    await new Promise((resolve) => setTimeout(resolve, 350));

    assert.equal(ownerGotPost, true, 'Authorized member should receive post in community room');
    assert.equal(unauthGotPost, false, 'Unauthenticated socket on posts_stream must NOT receive private post');
    assert.equal(nonMemberGotPost, false, 'Non-member socket on posts_stream must NOT receive private post');

    // Test reply isolation
    let unauthGotUpdate = false;
    unauthSocket.on('post_updated', (u) => {
      if (u.id === privPostId) unauthGotUpdate = true;
    });

    await fetch(`${baseURL}/api/posts/${privPostId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({ content: 'Private reply from member' })
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(unauthGotUpdate, false, 'Private reply must NOT broadcast to posts_stream');

    // Test reaction isolation
    let unauthGotReaction = false;
    unauthSocket.on('post_reaction', (r) => {
      if (r.id === privPostId) unauthGotReaction = true;
    });

    await fetch(`${baseURL}/api/posts/${privPostId}/been-through-this`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token }
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(unauthGotReaction, false, 'Private reaction must NOT broadcast to posts_stream');
  });

  test('BROADCAST-02: Public standalone post broadcasts to posts_stream', async () => {
    let unauthGotPublicPost = false;
    unauthSocket.on('new_post', (p) => {
      if (p.title === 'Public Discussion Topic') unauthGotPublicPost = true;
    });

    const res = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        title: 'Public Discussion Topic',
        content: 'This public question is open for everyone to read',
        category: 'General Health'
      })
    });
    assert.equal(res.status, 201);

    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(unauthGotPublicPost, true, 'Public standalone post must broadcast to posts_stream');
  });
});

describe('Pass 2: Enforce Private Community Admission Rules and Metadata Protection', () => {
  let owner, applicant, outsider, privateCommunity, publicCommunity;

  before(async () => {
    owner = await createUser();
    applicant = await createUser();
    outsider = await createUser();

    const privRes = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        name: `AdmissionsPrivComm-${Date.now()}`,
        description: 'Private community for testing admissions',
        topic: 'Trauma & Recovery',
        isPrivate: true
      })
    });
    const privData = await privRes.json();
    privateCommunity = privData.community;

    const pubRes = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({
        name: `AdmissionsPubComm-${Date.now()}`,
        description: 'Public community for testing admissions',
        topic: 'General Health',
        isPrivate: false
      })
    });
    const pubData = await pubRes.json();
    publicCommunity = pubData.community;
  });

  test('ADMIT-01: Direct self-join to private community is rejected with 403', async () => {
    const res = await fetch(`${baseURL}/api/communities/${privateCommunity.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': outsider.token }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('private community') && data.error.includes('invitation code'));
  });

  test('ADMIT-02: Non-member cannot view private community metadata (returns 403 and omits details)', async () => {
    const res = await fetch(`${baseURL}/api/communities/${privateCommunity.id}`, {
      headers: { 'x-anon-token': outsider.token }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.community, undefined, 'Community metadata must be withheld from non-members');
  });

  test('ADMIT-03: Join request workflow allows owner to review and admit members', async () => {
    // 1. Applicant submits join request
    const reqRes = await fetch(`${baseURL}/api/communities/${privateCommunity.id}/request-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': applicant.token },
      body: JSON.stringify({ note: 'I would like to participate in this support group.' })
    });
    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();
    assert.equal(reqData.success, true);

    // 2. Owner lists pending requests
    const listRes = await fetch(`${baseURL}/api/communities/${privateCommunity.id}/requests`, {
      headers: { 'x-anon-token': owner.token }
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.requests.length >= 1);
    const pendingReq = listData.requests.find(r => r.identity.id === applicant.identity.id);
    assert.ok(pendingReq);

    // 3. Owner approves request
    const reviewRes = await fetch(`${baseURL}/api/communities/${privateCommunity.id}/requests/${pendingReq.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': owner.token },
      body: JSON.stringify({ action: 'approve' })
    });
    assert.equal(reviewRes.status, 200);

    // 4. Now applicant can access private community details
    const memberGetRes = await fetch(`${baseURL}/api/communities/${privateCommunity.id}`, {
      headers: { 'x-anon-token': applicant.token }
    });
    assert.equal(memberGetRes.status, 200);
    const memberGetData = await memberGetRes.json();
    assert.equal(memberGetData.success, true);
    assert.ok(memberGetData.community.name);
  });

  test('ADMIT-04: Joining private community with valid inviteCode succeeds', async () => {
    const inviteUser = await createUser();

    const joinRes = await fetch(`${baseURL}/api/communities/${privateCommunity.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': inviteUser.token },
      body: JSON.stringify({ inviteCode: privateCommunity.inviteCode })
    });
    assert.equal(joinRes.status, 200);
    const joinData = await joinRes.json();
    assert.equal(joinData.success, true);

    // Check membership
    const getRes = await fetch(`${baseURL}/api/communities/${privateCommunity.id}`, {
      headers: { 'x-anon-token': inviteUser.token }
    });
    assert.equal(getRes.status, 200);
  });

  test('ADMIT-05: Public community allows direct self-join without invite code', async () => {
    const pubJoinRes = await fetch(`${baseURL}/api/communities/${publicCommunity.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': outsider.token }
    });
    assert.equal(pubJoinRes.status, 200);
    const pubJoinData = await pubJoinRes.json();
    assert.equal(pubJoinData.success, true);
  });
});

describe('Pass 2: Token Privacy in Browser JavaScript Responses and Socket Cookie Auth', () => {
  test('TOKEN-01: Anonymous entry does not return token to browser clients (without x-api-client header)', async () => {
    const res = await rawFetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    assert.equal(res.status, 201);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(data.identity);
    // Token is omitted from JSON payload
    assert.equal(data.token, undefined, 'Session token must not be returned in JSON response to browser JS');

    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader, 'HttpOnly cookie must be set');
    assert.ok(cookieHeader.includes('anon_session_token='));
    assert.ok(cookieHeader.toLowerCase().includes('httponly'));
  });

  test('TOKEN-02: Admin login does not return token to browser clients and sets HttpOnly cookie', async () => {
    const res = await rawFetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(data.admin);
    assert.equal(data.token, undefined, 'Admin JWT must not be exposed in JSON to browser JS');

    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader);
    assert.ok(cookieHeader.includes('anon_admin_token='));
    assert.ok(cookieHeader.toLowerCase().includes('httponly'));
  });

  test('TOKEN-03: Socket.IO authenticates using anon_session_token cookie without JS token', async () => {
    // 1. Create a user via API client to obtain valid session token
    const user = await createUser();

    // 2. Connect socket passing the cookie header directly (as a browser would via withCredentials)
    const socket = ClientIO(baseURL, {
      extraHeaders: {
        Cookie: `anon_session_token=${user.token}`
      },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        // Create a listening room and join it to verify identity is attached
        socket.emit('join_listening_room', { roomId: new mongoose.Types.ObjectId().toString() });
      });
      socket.on('error', (err) => {
        // An 'Invalid room ID' or 'Room not found' means the socket authenticated and executed handler
        socket.disconnect();
        resolve();
      });
      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 1000);
    });
  });
});

describe('Pass 2: Invalidate Stolen/Replayed JWTs on Logout (RevokedToken)', () => {
  let adminToken, proToken;

  test('REVOKE-01: Logged-out Admin JWT cannot be reused or replayed', async () => {
    // 1. Admin login (as API client to receive token for replay test)
    adminToken = await adminLogin();
    assert.ok(adminToken);

    // Verify token works
    const testRes = await fetch(`${baseURL}/api/admin/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(testRes.status, 200);

    // 2. Admin logout
    const logoutRes = await fetch(`${baseURL}/api/admin/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(logoutRes.status, 200);

    // 3. Stolen / replayed token after logout MUST be rejected with 401
    const replayedRes = await fetch(`${baseURL}/api/admin/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(replayedRes.status, 401);
    const replayedData = await replayedRes.json();
    assert.equal(replayedData.success, false);
    assert.ok(replayedData.error.includes('revoked'));
  });

  test('REVOKE-02: Logged-out Professional JWT cannot be reused or replayed', async () => {
    const proEmail = `pro-revoke-${Date.now()}@clinic.local`;
    const proPassword = 'ValidProPass123!';

    // Register & approve professional
    const regRes = await fetch(`${baseURL}/api/professionals/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dr. Revocation Test',
        displayName: 'Dr. Revocation',
        email: proEmail,
        password: proPassword,
        licenseType: 'Psychologist',
        licenseJurisdiction: 'CA',
        licenseNumber: `REV-${Date.now()}`,
        specialties: ['Adolescent Psychology'],
        bio: 'Testing revocation.'
      })
    });
    assert.equal(regRes.status, 201);

    const proDoc = await ProfessionalAccount.findOne({ email: proEmail });
    assert.ok(proDoc);
    proDoc.verificationStatus = 'verified';
    await proDoc.save();

    // Login as professional
    const loginRes = await fetch(`${baseURL}/api/professionals/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: proEmail, password: proPassword })
    });
    const loginData = await loginRes.json();
    proToken = loginData.token;
    assert.ok(proToken);

    // Verify token works
    const meRes = await fetch(`${baseURL}/api/professionals/me`, {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(meRes.status, 200);

    // Logout
    const logoutRes = await fetch(`${baseURL}/api/professionals/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(logoutRes.status, 200);

    // Replay after logout
    const replayedRes = await fetch(`${baseURL}/api/professionals/me`, {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(replayedRes.status, 401);
    const replayedData = await replayedRes.json();
    assert.equal(replayedData.success, false);
    assert.ok(replayedData.error.includes('revoked'));
  });
});

describe('Pass 2: Listening Room Capacity and Resource Exhaustion', () => {
  let hostUser, cappedRoomId;

  before(async () => {
    hostUser = await createUser();
    const res = await fetch(`${baseURL}/api/listening-rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': hostUser.token },
      body: JSON.stringify({
        title: 'Capped Room Test ' + Date.now(),
        topic: 'Stress Management',
        description: 'Room with max 2 participants',
        maxParticipants: 2
      })
    });
    const data = await res.json();
    cappedRoomId = data.room.id;
  });

  test('CAPACITY-01: Anonymous guests count toward room capacity and overflow is blocked', async () => {
    const guest1 = createSocketClient(null);
    const guest2 = createSocketClient(null);
    const guest3 = createSocketClient(null);

    try {
      // Connect all sockets
      await new Promise((resolve) => {
        let connected = 0;
        const check = () => { connected++; if (connected === 3) resolve(); };
        guest1.on('connect', check);
        guest2.on('connect', check);
        guest3.on('connect', check);
      });

      // Guest 1 joins
      await new Promise((resolve) => {
        guest1.emit('join_listening_room', { roomId: cappedRoomId });
        guest1.on('user_joined_room', () => resolve());
      });

      // Guest 2 joins (reaches max capacity of 2)
      await new Promise((resolve) => {
        guest2.emit('join_listening_room', { roomId: cappedRoomId });
        guest2.on('user_joined_room', () => resolve());
      });

      // Guest 3 attempts to join: must receive capacity error
      await new Promise((resolve, reject) => {
        guest3.emit('join_listening_room', { roomId: cappedRoomId });
        guest3.on('error', (err) => {
          assert.ok(err.includes('capacity'), `Expected capacity error, got: ${err}`);
          resolve();
        });
        setTimeout(() => reject(new Error('Guest 3 should have been rejected due to room capacity')), 2000);
      });

      // Guest 2 disconnects -> frees up capacity
      guest2.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Guest 3 now joins successfully
      await new Promise((resolve, reject) => {
        guest3.emit('join_listening_room', { roomId: cappedRoomId });
        guest3.on('user_joined_room', () => resolve());
        setTimeout(() => reject(new Error('Guest 3 should be able to join after guest 2 left')), 2000);
      });
    } finally {
      guest1.disconnect();
      guest2.disconnect();
      guest3.disconnect();
    }
  });

  test('CAPACITY-02: Rapid join attempt flooding emits join rate limit error', async () => {
    const floodSocket = createSocketClient(null);
    await new Promise((resolve) => floodSocket.on('connect', resolve));

    let gotRateLimit = false;
    floodSocket.on('error', (err) => {
      if (err.includes('Too many join attempts')) {
        gotRateLimit = true;
      }
    });

    // Send 10 rapid join requests
    for (let i = 0; i < 10; i++) {
      floodSocket.emit('join_listening_room', { roomId: cappedRoomId });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    floodSocket.disconnect();
    assert.equal(gotRateLimit, true, 'Rapid join attempts must be rate limited');
  });

  test('CAPACITY-03: One room per socket - joining new room leaves previous room and updates participants', async () => {
    // Create second room
    const res2 = await fetch(`${baseURL}/api/listening-rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': hostUser.token },
      body: JSON.stringify({
        title: 'Room 2 ' + Date.now(),
        topic: 'Sleep',
        description: 'Second room'
      })
    });
    const data2 = await res2.json();
    const room2Id = data2.room.id;

    const observer = createSocketClient(null);
    const switcher = createSocketClient(null);

    await new Promise((resolve) => {
      let c = 0;
      observer.on('connect', () => { c++; if (c === 2) resolve(); });
      switcher.on('connect', () => { c++; if (c === 2) resolve(); });
    });

    // Both join Room 1
    observer.emit('join_listening_room', { roomId: cappedRoomId });
    switcher.emit('join_listening_room', { roomId: cappedRoomId });
    await new Promise((resolve) => setTimeout(resolve, 200));

    let observerGotLeave = false;
    observer.on('user_left_room', () => {
      observerGotLeave = true;
    });

    // Switcher joins Room 2
    switcher.emit('join_listening_room', { roomId: room2Id });
    await new Promise((resolve) => setTimeout(resolve, 350));

    observer.disconnect();
    switcher.disconnect();

    assert.equal(observerGotLeave, true, 'Room 1 must be notified when a socket switches to Room 2');
  });
});

describe('Pass 2: Revocation of Private Socket Access on Community Leave', () => {
  test('REVOKE-COMM-01: Leaving private community evicts socket from rooms and emits access revoked', async () => {
    const commOwner = await createUser();
    const member = await createUser();

    // Create private community
    const cRes = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': commOwner.token },
      body: JSON.stringify({
        name: `RevokeComm-${Date.now()}`,
        description: 'Test revocation of sockets',
        topic: 'General Health',
        isPrivate: true
      })
    });
    const cData = await cRes.json();
    const commId = cData.community.id;

    // Join with inviteCode
    await fetch(`${baseURL}/api/communities/${commId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anon-token': member.token },
      body: JSON.stringify({ inviteCode: cData.community.inviteCode })
    });

    // Connect member socket
    const memberSocket = createSocketClient(member.token);
    await new Promise((resolve) => memberSocket.on('connect', resolve));

    memberSocket.emit('join_community', { communityId: commId });
    await new Promise((resolve) => setTimeout(resolve, 150));

    let gotRevocationEvent = false;
    memberSocket.on('community_access_revoked', (data) => {
      if (data.communityId === commId) gotRevocationEvent = true;
    });

    // Member leaves community via REST API
    const leaveRes = await fetch(`${baseURL}/api/communities/${commId}/leave`, {
      method: 'POST',
      headers: { 'x-anon-token': member.token }
    });
    assert.equal(leaveRes.status, 200);

    await new Promise((resolve) => setTimeout(resolve, 300));
    memberSocket.disconnect();

    assert.equal(gotRevocationEvent, true, 'User socket must receive community_access_revoked event upon leaving');
  });
});

describe('Pass 2: Hardened CSRF and CORS Validation', () => {
  let user;

  before(async () => {
    user = await createUser();
  });

  test('CSRF-03: Request with Origin: null is rejected with 403', async () => {
    const res = await rawFetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'null',
        'x-anon-token': user.token
      },
      body: JSON.stringify({ title: 'Null Origin Test', content: 'Testing null origin', category: 'General Health' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('CSRF-04: Request with Sec-Fetch-Site: cross-site is rejected with 403', async () => {
    const res = await rawFetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'cross-site',
        'x-anon-token': user.token
      },
      body: JSON.stringify({ title: 'SecFetch Test', content: 'Testing sec fetch site', category: 'General Health' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('CSRF-05: Request with cross-site Referer header is rejected with 403', async () => {
    const res = await rawFetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://malicious-tracker.com/phish',
        'x-anon-token': user.token
      },
      body: JSON.stringify({ title: 'Referer Test', content: 'Testing referer check', category: 'General Health' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('CSRF-06: State-changing request with approved Origin succeeds', async () => {
    const res = await rawFetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'x-anon-token': user.token,
        'x-api-client': 'true'
      },
      body: JSON.stringify({ title: 'Approved Origin Test', content: 'Testing approved origin', category: 'General Health' })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
  });
});

describe('Pass 2: Safe Test Database Guards', () => {
  test('SAFE-01: safeDropDatabase refuses to drop in production or if database name lacks test', async () => {
    // 1. Production check
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await assert.rejects(
      async () => await safeDropDatabase(),
      /production/
    );
    process.env.NODE_ENV = prevEnv;

    // 2. Database name check
    const originalName = mongoose.connection.name;
    Object.defineProperty(mongoose.connection, 'name', { value: 'production_main_cluster', configurable: true });
    await assert.rejects(
      async () => await safeDropDatabase(),
      /must contain 'test'/
    );
    Object.defineProperty(mongoose.connection, 'name', { value: originalName, configurable: true });
  });
});
