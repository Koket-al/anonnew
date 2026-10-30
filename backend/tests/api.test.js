process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/anon_test_db';
process.env.SESSION_SECRET = 'test_session_secret_32bytes_long_string';
process.env.JWT_SECRET = 'test_jwt_secret_32bytes_long_str_ok';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL;
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { ProfessionalAccount } from '../src/models/ProfessionalAccount.js';

let baseURL;
let testServer;

// API Test client fetch wrapper: passes x-api-client header for explicit API clients
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
    testServer = app.listen(0, () => {
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

describe('ANON Backend API Tests', () => {
  let user1Token;
  let user1Identity;
  let user2Token;
  let user2Identity;
  let testCommunityId;
  let testPostId;
  let testConversationId;
  let pendingProId;

  test('1. Anonymous Entry - Creates secure anonymous session and identity', async () => {
    const res = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    assert.equal(res.status, 201);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(data.identity.username);
    // Verifies cryptographic random string format (e.g., Ab1z4Qt - 7 alphanumeric characters)
    assert.match(data.identity.username, /^[A-Za-z0-9]{7}$/);
    assert.ok(data.token);

    user1Token = data.token;
    user1Identity = data.identity;
  });

  test('2. Current Identity - Retrieves active anonymous profile with session token and identity pool', async () => {
    const res = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.identity.username, user1Identity.username);
    assert.equal(data.identities.length, 1);
    assert.equal(data.maxIdentities, 5);
    assert.equal(data.canCreateMore, true);
  });

  test('3. Second Anonymous User Creation', async () => {
    const res = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    assert.equal(res.status, 201);
    const data = await res.json();

    assert.notEqual(data.identity.username, user1Identity.username);
    assert.match(data.identity.username, /^[A-Za-z0-9]{7}$/);
    user2Token = data.token;
    user2Identity = data.identity;
  });

  test('4. Create Community by Anonymous User', async () => {
    const res = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        name: 'Stress and Sleep Lab ' + Math.floor(Math.random() * 1000),
        description: 'Sharing nonjudgmental habits for when insomnia strikes.',
        topic: 'General Health'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    testCommunityId = data.community.id;
  });

  test('5. Join Community by Second User', async () => {
    const res = await fetch(`${baseURL}/api/communities/${testCommunityId}/join`, {
      method: 'POST',
      headers: { 'x-anon-token': user2Token }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  test('6. Create Post with "Has anyone been through this?" flag', async () => {
    const res = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        title: 'Has anyone experienced heart palpitations before presentations?',
        content: 'Whenever I have to stand in front of the class, my chest tightens and my vision blurs. Has anyone been through this and found something that helps?',
        communityId: testCommunityId,
        category: 'General Health',
        hasBeenThroughThis: true
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.post.hasBeenThroughThis, true);
    testPostId = data.post.id;
  });

  test('7. Toggle "I\'ve been through this" response', async () => {
    const res = await fetch(`${baseURL}/api/posts/${testPostId}/been-through-this`, {
      method: 'POST',
      headers: { 'x-anon-token': user2Token }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.hasMarkedBeenThroughThis, true);
    assert.equal(data.beenThroughThisCount, 1);
  });

  test('8. Create Reply with Experience Share', async () => {
    const res = await fetch(`${baseURL}/api/posts/${testPostId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({
        content: 'Yes! I hold a small smooth stone in my pocket and touch it to ground myself. It breaks the panic loop.',
        isExperienceShare: true
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.reply.isExperienceShare, true);
  });

  test('9. Private Connection Request and Acceptance Flow', async () => {
    const reqRes = await fetch(`${baseURL}/api/messages/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({
        targetIdentityId: user1Identity.id,
        initialNote: 'I saw your question about presentation anxiety and wanted to chat quietly.',
        relatedPostId: testPostId
      })
    });

    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();
    assert.equal(reqData.success, true);
    testConversationId = reqData.conversationId;

    const acceptRes = await fetch(`${baseURL}/api/messages/${testConversationId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ action: 'accept' })
    });

    assert.equal(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.equal(acceptData.status, 'accepted');

    const msgRes = await fetch(`${baseURL}/api/messages/${testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({ content: 'Hi there, thank you for accepting.' })
    });

    assert.equal(msgRes.status, 201);
    const msgData = await msgRes.json();
    assert.equal(msgData.message.content, 'Hi there, thank you for accepting.');
  });

  test('10. Unauthorized Private Message Access Blocked', async () => {
    const thirdUserRes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const thirdUserData = await thirdUserRes.json();

    const eavesdropRes = await fetch(`${baseURL}/api/messages/${testConversationId}/messages`, {
      headers: { 'x-anon-token': thirdUserData.token }
    });

    assert.equal(eavesdropRes.status, 403);
  });

  test('11. Register Fresh Professional (Pending Status)', async () => {
    const uniqueEmail = `test.pro.${Date.now()}@example.com`;
    const regRes = await fetch(`${baseURL}/api/professionals/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        fullName: 'Dr. Test Clinician',
        displayName: 'Dr. Test Clinician, Psy.D.',
        licenseType: 'Licensed Clinical Psychologist',
        licenseNumber: 'PSY-TEST-999',
        specialties: ['Youth Anxiety'],
        bio: 'Dedicated youth specialist.'
      })
    });

    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.professional.verificationStatus, 'pending');
    pendingProId = regData.professional.id;

    // Verify directory does NOT show this pending pro
    const dirRes = await fetch(`${baseURL}/api/professionals/directory`);
    const dirData = await dirRes.json();
    assert.ok(!dirData.professionals.some(p => p.id === pendingProId));
  });

  test('12. Moderation Workflow - Review and Verify Pending Professional', async () => {
    // New auth: moderator identity uses anonymous session token, with isModerator=true set by admin.
    // Step 1: Create a new anonymous identity for the moderator
    const modEntryRes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const modEntryData = await modEntryRes.json();
    const modToken = modEntryData.token;
    const modIdentityId = modEntryData.identity.id;

    // Step 2: Admin grants moderator role to this identity
    const adminLoginRes = await fetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    const adminData = await adminLoginRes.json();
    assert.equal(adminLoginRes.status, 200, 'Admin login should succeed');

    const grantRes = await fetch(`${baseURL}/api/admin/identities/${modIdentityId}/moderator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminData.token}`
      },
      body: JSON.stringify({ grant: true })
    });
    assert.equal(grantRes.status, 200, 'Moderator grant should succeed');

    // Step 3: Moderator verifies the professional using anonymous session token
    const verifyRes = await fetch(`${baseURL}/api/moderation/professionals/${pendingProId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': modToken
      },
      body: JSON.stringify({
        decision: 'verify',
        notes: 'Verified against state test board.'
      })
    });

    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.verificationStatus, 'verified');

    // Now directory MUST show this pro
    const dirRes = await fetch(`${baseURL}/api/professionals/directory`);
    const dirData = await dirRes.json();
    assert.ok(dirData.professionals.some(p => p.id === pendingProId));
  });

  test('13. Multi-Identity System - Create additional cryptographic identity up to 5', async () => {
    // User1 currently has 1 identity. Create a second one.
    const createRes = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: { 'x-anon-token': user1Token }
    });

    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.match(createData.identity.username, /^[A-Za-z0-9]{7}$/);
    assert.notEqual(createData.identity.username, user1Identity.username);
    assert.equal(createData.identities.length, 2);

    // Verify session still holds both identities
    const meRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1Token }
    });
    const meData = await meRes.json();
    assert.equal(meData.identities.length, 2);
    assert.ok(meData.identities.some(i => i.username === user1Identity.username));
    assert.ok(meData.identities.some(i => i.username === createData.identity.username));
  });

  test('14. Switch Active Identity - Keeps all previous identities intact', async () => {
    // Switch active identity back to user1Identity
    const switchRes = await fetch(`${baseURL}/api/auth/switch-identity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ identityId: user1Identity.id })
    });

    assert.equal(switchRes.status, 200);
    const switchData = await switchRes.json();
    assert.equal(switchData.identity.id, user1Identity.id);
    assert.equal(switchData.identities.length, 2);
  });

  test('15. Enforce 5 Identity Maximum per User', async () => {
    // User1 has 2 identities. Create 3 more to reach 5.
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseURL}/api/auth/identities`, {
        method: 'POST',
        headers: { 'x-anon-token': user1Token }
      });
      assert.equal(res.status, 201);
    }

    const checkRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1Token }
    });
    const checkData = await checkRes.json();
    assert.equal(checkData.identities.length, 5);
    assert.equal(checkData.canCreateMore, false);

    // Attempting to create a 6th identity MUST fail with 400
    const failRes = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(failRes.status, 400);
    const failData = await failRes.json();
    assert.ok(failData.error.includes('maximum of 5'));
  });

  test('16. Standalone Message Deletion - User can delete message without deleting identity', async () => {
    // Switch active identity back to user1Identity who is participant in testConversationId
    await fetch(`${baseURL}/api/auth/switch-identity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ identityId: user1Identity.id })
    });

    // 1. Send a private message in conversation between user1 and user2
    const sendRes = await fetch(`${baseURL}/api/messages/${testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ content: 'Secret temporary message to be deleted' })
    });
    assert.equal(sendRes.status, 201);
    const sendData = await sendRes.json();
    const messageId = sendData.message.id;

    // 2. User deletes the message directly
    const deleteRes = await fetch(`${baseURL}/api/messages/message/${messageId}`, {
      method: 'DELETE',
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(deleteRes.status, 200);

    // 3. Verify message is gone from conversation
    const listRes = await fetch(`${baseURL}/api/messages/${testConversationId}/messages`, {
      headers: { 'x-anon-token': user1Token }
    });
    const listData = await listRes.json();
    assert.ok(!listData.messages.some(m => m.id === messageId));

    // 4. Verify identity remains intact
    const meRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(meRes.status, 200);
  });

  test('17. Standalone Post and Reply Deletion', async () => {
    // Create a post
    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        title: 'Post to delete',
        content: 'This post will be deleted without touching identity'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    const createdPostId = postData.post.id;

    // Delete post
    const delRes = await fetch(`${baseURL}/api/posts/${createdPostId}`, {
      method: 'DELETE',
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(delRes.status, 200);

    // Verify getting post returns 404
    const getRes = await fetch(`${baseURL}/api/posts/${createdPostId}`);
    assert.equal(getRes.status, 404);
  });

  test('18. Conscious Removal of Identity - Option to Leave Messages for Others', async () => {
    // User1 has 5 identities. Pick one to remove with deleteMessages: false
    const meRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1Token }
    });
    const meData = await meRes.json();
    const identityToRemove = meData.identities.find(i => i.id !== meData.identity.id);

    // Create a post under that identity to verify it stays
    await fetch(`${baseURL}/api/auth/switch-identity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ identityId: identityToRemove.id })
    });

    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        title: 'Community wisdom to leave behind',
        content: 'This question stays for others even if identity is deleted.'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    const preservedPostId = postData.post.id;

    // Consciously delete identity with deleteMessages = false
    const delIdentRes = await fetch(`${baseURL}/api/auth/identities/${identityToRemove.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ deleteMessages: false })
    });
    assert.equal(delIdentRes.status, 200);
    const delIdentData = await delIdentRes.json();
    assert.equal(delIdentData.identities.length, 4);

    // Post MUST still exist
    const checkPostRes = await fetch(`${baseURL}/api/posts/${preservedPostId}`);
    assert.equal(checkPostRes.status, 200);

    // User can now create another identity because count is 4 (< 5)
    const newCreateRes = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(newCreateRes.status, 201);
  });

  test('19. Conscious Removal of Identity - Option to Purge Messages', async () => {
    const meRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': user1Token }
    });
    const meData = await meRes.json();
    const identityToRemove = meData.identities[1];

    // Switch to it and create a post
    await fetch(`${baseURL}/api/auth/switch-identity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ identityId: identityToRemove.id })
    });

    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        title: 'Sensitive question to purge',
        content: 'This must be completely purged when identity is removed.'
      })
    });
    const postData = await postRes.json();
    const purgedPostId = postData.post.id;

    // Consciously delete identity with deleteMessages = true
    const delIdentRes = await fetch(`${baseURL}/api/auth/identities/${identityToRemove.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ deleteMessages: true })
    });
    assert.equal(delIdentRes.status, 200);

    // Post MUST now be 404 (purged)
    const checkPostRes = await fetch(`${baseURL}/api/posts/${purgedPostId}`);
    assert.equal(checkPostRes.status, 404);
  });

  test('20. Unauthenticated visitor receives null identity without error', async () => {
    const res = await fetch(`${baseURL}/api/auth/me`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.identity, null);
    assert.equal(data.identities.length, 0);
  });

  test('21. User can explicitly create their first identity via /api/auth/identities', async () => {
    const res = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'First time creator' })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.identity);
    assert.ok(data.identity.username);
    assert.match(data.identity.username, /^[A-Za-z0-9]{7}$/);
    assert.ok(data.token);
    assert.equal(data.identities.length, 1);
  });

  test('22. Deleting only identity leaves user with 0 identities without auto-recreating one', async () => {
    // Create fresh user
    const createRes = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const createData = await createRes.json();
    const token = createData.token;
    const identId = createData.identity.id;

    // Delete the only identity
    const delRes = await fetch(`${baseURL}/api/auth/identities/${identId}`, {
      method: 'DELETE',
      headers: { 'x-anon-token': token }
    });
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.identity, null);
    assert.equal(delData.identities.length, 0);

    // Verify /api/auth/me also returns null identity and does not auto-generate
    const meRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': token }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.identity, null);
    assert.equal(meData.identities.length, 0);
  });

  test('23. Leave Community - Removes user and updates community memberCount', async () => {
    // Check initial community count
    const commResBefore = await fetch(`${baseURL}/api/communities/${testCommunityId}`);
    const commDataBefore = await commResBefore.json();
    const countBefore = commDataBefore.community.memberCount;

    // User2 leaves the community
    const leaveRes = await fetch(`${baseURL}/api/communities/${testCommunityId}/leave`, {
      method: 'POST',
      headers: { 'x-anon-token': user2Token }
    });
    assert.equal(leaveRes.status, 200);
    const leaveData = await leaveRes.json();
    assert.equal(leaveData.success, true);
    assert.equal(leaveData.isMember, false);
    assert.equal(leaveData.memberCount, countBefore - 1);

    // Verify community memberCount updated and isMember is false
    const commResAfter = await fetch(`${baseURL}/api/communities/${testCommunityId}`, {
      headers: { 'x-anon-token': user2Token }
    });
    const commDataAfter = await commResAfter.json();
    assert.equal(commDataAfter.community.memberCount, countBefore - 1);
    assert.equal(commDataAfter.community.isMember, false);
  });

  test('24. Conscious Removal of Identity - Automatically deletes user from all joined communities and updates memberCount', async () => {
    // 1. Create a dedicated user
    const createRes = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const createData = await createRes.json();
    const tempUserToken = createData.token;
    const tempIdentityId = createData.identity.id;

    // 2. Create another community with user1
    const newCommRes = await fetch(`${baseURL}/api/communities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        name: 'Mindfulness Practice',
        description: 'Quiet breathing and grounding techniques for teens.',
        topic: 'Mental Well-being'
      })
    });
    const newCommData = await newCommRes.json();
    const mindfulnessCommId = newCommData.community.id;

    // 3. Temp user joins both testCommunityId and mindfulnessCommId
    await fetch(`${baseURL}/api/communities/${testCommunityId}/join`, {
      method: 'POST',
      headers: { 'x-anon-token': tempUserToken }
    });
    await fetch(`${baseURL}/api/communities/${mindfulnessCommId}/join`, {
      method: 'POST',
      headers: { 'x-anon-token': tempUserToken }
    });

    // Check counts before deletion
    const c1ResBefore = await fetch(`${baseURL}/api/communities/${testCommunityId}`, {
      headers: { 'x-anon-token': tempUserToken }
    });
    const c1DataBefore = await c1ResBefore.json();
    assert.equal(c1DataBefore.community.isMember, true);
    const c1CountBefore = c1DataBefore.community.memberCount;

    const c2ResBefore = await fetch(`${baseURL}/api/communities/${mindfulnessCommId}`, {
      headers: { 'x-anon-token': tempUserToken }
    });
    const c2DataBefore = await c2ResBefore.json();
    assert.equal(c2DataBefore.community.isMember, true);
    const c2CountBefore = c2DataBefore.community.memberCount;

    // 4. Temp user deletes their identity
    const delRes = await fetch(`${baseURL}/api/auth/identities/${tempIdentityId}`, {
      method: 'DELETE',
      headers: { 'x-anon-token': tempUserToken }
    });
    assert.equal(delRes.status, 200);

    // 5. Verify both communities have been updated and member count decreased by 1
    const c1ResAfter = await fetch(`${baseURL}/api/communities/${testCommunityId}`);
    const c1DataAfter = await c1ResAfter.json();
    assert.equal(c1DataAfter.community.memberCount, c1CountBefore - 1);

    const c2ResAfter = await fetch(`${baseURL}/api/communities/${mindfulnessCommId}`);
    const c2DataAfter = await c2ResAfter.json();
    assert.equal(c2DataAfter.community.memberCount, c2CountBefore - 1);
  });

  test('25. Community Owner can view anonymous usernames of members who joined their community', async () => {
    // Have user2 rejoin testCommunityId
    await fetch(`${baseURL}/api/communities/${testCommunityId}/join`, {
      method: 'POST',
      headers: { 'x-anon-token': user2Token }
    });

    // 1. Community owner (user1) requests member roster
    const ownerRes = await fetch(`${baseURL}/api/communities/${testCommunityId}/members`, {
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(ownerRes.status, 200);
    const ownerData = await ownerRes.json();
    assert.equal(ownerData.success, true);
    assert.ok(Array.isArray(ownerData.members));
    assert.ok(ownerData.members.length >= 2);

    // Verify member anonymous usernames are present
    const usernames = ownerData.members.map(m => m.username);
    assert.ok(usernames.includes(user1Identity.username));
    assert.ok(usernames.includes(user2Identity.username));

    // Verify roles
    const creatorMember = ownerData.members.find(m => m.identityId === user1Identity.id);
    assert.equal(creatorMember.role, 'creator');

    // 2. Non-owner (user2) attempts to request member roster - must be rejected with 403
    const nonOwnerRes = await fetch(`${baseURL}/api/communities/${testCommunityId}/members`, {
      headers: { 'x-anon-token': user2Token }
    });
    assert.equal(nonOwnerRes.status, 403);
    const nonOwnerData = await nonOwnerRes.json();
    assert.equal(nonOwnerData.success, false);
    assert.ok(nonOwnerData.error.includes('Only the community owner'));
  });

  test('26. Community Owner can delete any message/reply written by another user in their community', async () => {
    // 1. User2 writes a reply on testPostId in testCommunityId
    const replyRes = await fetch(`${baseURL}/api/posts/${testPostId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({ content: 'A message by user2 that community owner will remove.' })
    });
    assert.equal(replyRes.status, 201);
    const replyData = await replyRes.json();
    const replyId = replyData.reply.id;

    // 2. Community owner (user1) deletes the reply written by user2
    const delReplyRes = await fetch(`${baseURL}/api/posts/replies/${replyId}`, {
      method: 'DELETE',
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(delReplyRes.status, 200);
    const delReplyData = await delReplyRes.json();
    assert.equal(delReplyData.success, true);

    // 3. Verify reply is no longer visible to the community owner
    const getPostRes = await fetch(`${baseURL}/api/posts/${testPostId}`, {
      headers: { 'x-anon-token': user1Token }
    });
    const postData = await getPostRes.json();
    assert.ok(!postData.replies.some(r => r.id === replyId));
  });

  test('27. Community Owner can delete any question/post written by another user in their community', async () => {
    // 1. User2 creates a post inside testCommunityId (owned by user1)
    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({
        title: 'Question written by user2 to be deleted by community owner',
        content: 'This post is inside testCommunityId and will be deleted by the community owner.',
        communityId: testCommunityId,
        category: 'General Discussion'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    const targetPostId = postData.post.id;

    // 2. Community owner (user1) deletes the post via deletePost endpoint
    const delPostRes = await fetch(`${baseURL}/api/posts/${targetPostId}`, {
      method: 'DELETE',
      headers: { 'x-anon-token': user1Token }
    });
    assert.equal(delPostRes.status, 200);

    // 3. Verify post is no longer returned
    const getDeletedPostRes = await fetch(`${baseURL}/api/posts/${targetPostId}`);
    assert.equal(getDeletedPostRes.status, 404);
  });

  test('28. Community Gate - Non-member is blocked from listing posts of a community', async () => {
    // Create user3 who has NOT joined testCommunityId
    const res = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const user3Data = await res.json();
    const user3Token = user3Data.token;

    // 1. Unauthenticated request to list community posts -> 403
    const unauthListRes = await fetch(`${baseURL}/api/posts?communityId=${testCommunityId}`);
    assert.equal(unauthListRes.status, 403);
    const unauthData = await unauthListRes.json();
    assert.equal(unauthData.requiresMembership, true);

    // 2. Non-member user3 request to list community posts -> 403
    const user3ListRes = await fetch(`${baseURL}/api/posts?communityId=${testCommunityId}`, {
      headers: { 'x-anon-token': user3Token }
    });
    assert.equal(user3ListRes.status, 403);
    const user3ListData = await user3ListRes.json();
    assert.equal(user3ListData.requiresMembership, true);

    // 3. Non-member user3 request to view single community post -> 403
    const viewRes = await fetch(`${baseURL}/api/posts/${testPostId}`, {
      headers: { 'x-anon-token': user3Token }
    });
    assert.equal(viewRes.status, 403);
    const viewData = await viewRes.json();
    assert.equal(viewData.requiresMembership, true);

    // 4. Non-member user3 request to create post in community -> 403
    const createRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user3Token
      },
      body: JSON.stringify({
        title: 'Unauthorized community post',
        content: 'This should fail because user3 has not joined the community yet.',
        communityId: testCommunityId
      })
    });
    assert.equal(createRes.status, 403);
    const createData = await createRes.json();
    assert.equal(createData.requiresMembership, true);

    // 5. Non-member user3 request to reply to a community post -> 403
    const replyRes = await fetch(`${baseURL}/api/posts/${testPostId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user3Token
      },
      body: JSON.stringify({ content: 'Unauthorized reply by non-member.' })
    });
    assert.equal(replyRes.status, 403);
    const replyData = await replyRes.json();
    assert.equal(replyData.requiresMembership, true);

    // 6. User3 joins the community -> Now user3 can view and post!
    const joinRes = await fetch(`${baseURL}/api/communities/${testCommunityId}/join`, {
      method: 'POST',
      headers: { 'x-anon-token': user3Token }
    });
    assert.equal(joinRes.status, 200);

    // Now user3 can view community posts
    const allowedListRes = await fetch(`${baseURL}/api/posts?communityId=${testCommunityId}`, {
      headers: { 'x-anon-token': user3Token }
    });
    assert.equal(allowedListRes.status, 200);
    const allowedListData = await allowedListRes.json();
    assert.equal(allowedListData.success, true);
    assert.ok(Array.isArray(allowedListData.posts));

    // Now user3 can view the post detail
    const allowedViewRes = await fetch(`${baseURL}/api/posts/${testPostId}`, {
      headers: { 'x-anon-token': user3Token }
    });
    assert.equal(allowedViewRes.status, 200);

    // Now user3 can create a post in the community
    const allowedCreateRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user3Token
      },
      body: JSON.stringify({
        title: 'Authorized post after joining',
        content: 'Now that user3 joined the community, posting succeeds!',
        communityId: testCommunityId
      })
    });
    assert.equal(allowedCreateRes.status, 201);
  });

  test('29. Block Connection with Inactive, Non-existent, or Removed Identities', async () => {
    // 1. Create a user who creates a post and then consciously removes their identity
    const userARes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const userAData = await userARes.json();
    const userAToken = userAData.token;
    const userAIdentityId = userAData.identity.id;

    // Create a public post with userA
    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': userAToken
      },
      body: JSON.stringify({
        title: 'Post by user who will remove identity',
        content: 'This post is left behind for the community when identity is removed.',
        category: 'General Discussion'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    const postId = postData.post.id;

    // User A consciously removes their identity (leaving messages intact)
    const removeRes = await fetch(`${baseURL}/api/auth/identities/${userAIdentityId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': userAToken
      },
      body: JSON.stringify({ deleteMessages: false })
    });
    assert.equal(removeRes.status, 200);

    // 2. User B tries to send a connection request to the removed identity -> Blocked (404/400)
    const userBRes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const userBData = await userBRes.json();
    const userBToken = userBData.token;

    const connectRes = await fetch(`${baseURL}/api/messages/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': userBToken
      },
      body: JSON.stringify({
        targetIdentityId: userAIdentityId,
        initialNote: 'Trying to connect with removed persona'
      })
    });
    assert.ok(connectRes.status === 404 || connectRes.status === 400);
    const connectData = await connectRes.json();
    assert.equal(connectData.success, false);

    // 3. User B views the post: author is marked as removed and canConnect is false
    const checkPostRes = await fetch(`${baseURL}/api/posts/${postId}`, {
      headers: { 'x-anon-token': userBToken }
    });
    assert.equal(checkPostRes.status, 200);
    const checkPostData = await checkPostRes.json();
    assert.equal(checkPostData.post.author.isRemoved, true);
    assert.equal(checkPostData.post.canConnect, false);
  });

  test('30. Removing an identity only removes the specified identity and preserves all other identities', async () => {
    // 1. User enters and creates first identity
    const enterRes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const enterData = await enterRes.json();
    const token = enterData.token;
    const firstIdentityId = enterData.identity.id;
    const firstUsername = enterData.identity.username;

    // 2. User creates a second identity in the same session
    const secondRes = await fetch(`${baseURL}/api/auth/identities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': token
      },
      body: JSON.stringify({ bio: 'Second persona' })
    });
    assert.equal(secondRes.status, 201);
    const secondData = await secondRes.json();
    const secondIdentityId = secondData.identity.id;
    assert.equal(secondData.identities.length, 2);

    // 3. User removes ONLY the first identity
    const deleteRes = await fetch(`${baseURL}/api/auth/identities/${firstIdentityId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': token
      },
      body: JSON.stringify({ deleteMessages: false })
    });
    assert.equal(deleteRes.status, 200);
    const deleteData = await deleteRes.json();

    // 4. Verify only first identity was removed and second identity is still intact!
    assert.equal(deleteData.identities.length, 1);
    assert.equal(deleteData.identities[0].id, secondIdentityId);
    assert.equal(deleteData.identity.id, secondIdentityId);

    // Verify /api/auth/me confirms second identity persists
    const meRes = await fetch(`${baseURL}/api/auth/me`, {
      headers: { 'x-anon-token': token }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.identities.length, 1);
    assert.equal(meData.identities[0].id, secondIdentityId);
    assert.equal(meData.identity.id, secondIdentityId);
  });

  test('31. Sent and Seen Checkmarks (Single and Double Ticks)', async () => {
    // 1. Enter two users
    const userARes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const userA = await userARes.json();

    const userBRes = await fetch(`${baseURL}/api/auth/enter`, { method: 'POST' });
    const userB = await userBRes.json();

    // 2. User A sends connection request to User B
    const connReq = await fetch(`${baseURL}/api/messages/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': userA.token
      },
      body: JSON.stringify({ targetIdentityId: userB.identity.id, initialNote: 'Let us chat' })
    });
    assert.equal(connReq.status, 201);
    const connData = await connReq.json();
    const convId = connData.conversationId;

    // 3. User B accepts connection
    const acceptRes = await fetch(`${baseURL}/api/messages/${convId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': userB.token
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert.equal(acceptRes.status, 200);

    // 4. User A sends message: sender gets immediate single tick (readAt === null)
    const sendRes = await fetch(`${baseURL}/api/messages/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': userA.token
      },
      body: JSON.stringify({ content: 'Real-time checkmark test message' })
    });
    assert.equal(sendRes.status, 201);
    const sendData = await sendRes.json();
    assert.equal(sendData.message.isMine, true);
    assert.equal(sendData.message.readAt, null); // Single tick: sent

    // 5. User A inspects conversation before User B sees it: still single tick
    const checkBeforeSeen = await fetch(`${baseURL}/api/messages/${convId}/messages`, {
      headers: { 'x-anon-token': userA.token }
    });
    const checkBeforeData = await checkBeforeSeen.json();
    const msgBefore = checkBeforeData.messages.find(m => m.id === sendData.message.id);
    assert.ok(msgBefore);
    assert.equal(msgBefore.readAt, null); // Still single tick

    // 6. User B opens conversation (marks unread messages as read)
    const userBOpen = await fetch(`${baseURL}/api/messages/${convId}/messages`, {
      headers: { 'x-anon-token': userB.token }
    });
    assert.equal(userBOpen.status, 200);

    // 7. User A checks conversation: now double tick (readAt !== null)
    const checkAfterSeen = await fetch(`${baseURL}/api/messages/${convId}/messages`, {
      headers: { 'x-anon-token': userA.token }
    });
    const checkAfterData = await checkAfterSeen.json();
    const msgAfter = checkAfterData.messages.find(m => m.id === sendData.message.id);
    assert.ok(msgAfter);
    assert.ok(msgAfter.readAt !== null); // Double tick: seen!
  });

  test('32. Admin Login & Access Control - Rejects unauthorized and accepts environment-configured admin', async () => {
    // 1. Rejects wrong credentials
    const badLogin = await fetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intruder@domain.com', password: 'wrongpassword' })
    });
    assert.equal(badLogin.status, 401);

    // 2. Succeeds with configured admin credentials
    const validLogin = await fetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(validLogin.status, 200);
    const loginData = await validLogin.json();
    assert.equal(loginData.success, true);
    assert.ok(loginData.token);
    assert.equal(loginData.admin.email, process.env.ADMIN_EMAIL.toLowerCase());

    // 3. /api/admin/me returns admin profile
    const meRes = await fetch(`${baseURL}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.admin.role, 'admin');

    // 4. Block access without admin token
    const blockedRes = await fetch(`${baseURL}/api/admin/professionals/pending`);
    assert.equal(blockedRes.status, 401);

    const blockedStats = await fetch(`${baseURL}/api/admin/stats`);
    assert.equal(blockedStats.status, 401);

    // 5. /api/admin/stats returns real-time user usage and engagement analytics
    const statsRes = await fetch(`${baseURL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    assert.equal(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.equal(statsData.success, true);
    assert.ok(statsData.stats);
    assert.ok(typeof statsData.stats.users.totalUsers === 'number');
    assert.ok(typeof statsData.stats.users.activeUsers24h === 'number');
    assert.ok(typeof statsData.stats.users.totalPersonas === 'number');
    assert.ok(typeof statsData.stats.activity.totalPosts === 'number');
    assert.ok(typeof statsData.stats.activity.totalMessages === 'number');
    assert.ok(Array.isArray(statsData.stats.history));
  });

  test('33. Admin Clinician Application Review - Displays photo and approves doctor into directory', async () => {
    // 1. Admin login
    const adminLoginRes = await fetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    const { token: adminToken } = await adminLoginRes.json();

    // 2. Register applicant with photo
    const proPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const regRes = await fetch(`${baseURL}/api/professionals/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.doc@example.com',
        password: 'Password123!',
        fullName: 'Dr. Jane Smith, MD',
        displayName: 'Dr. Jane Smith',
        licenseType: 'Psychiatrist (MD/DO)',
        licenseNumber: 'MD-881920',
        licenseJurisdiction: 'New York, US',
        specialties: ['Adolescent Depression', 'Anxiety'],
        bio: 'Compassionate adolescent psychiatrist.',
        imageUrl: proPhoto
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    const applicantId = regData.professional.id;

    // 3. Admin lists pending applications: sees applicant with photo
    const pendingRes = await fetch(`${baseURL}/api/admin/professionals/pending`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(pendingRes.status, 200);
    const pendingData = await pendingRes.json();
    const foundApp = pendingData.applications.find(a => a.id === applicantId);
    assert.ok(foundApp);
    assert.equal(foundApp.imageUrl, proPhoto);
    assert.equal(foundApp.displayName, 'Dr. Jane Smith');

    // 4. Admin approves applicant
    const approveRes = await fetch(`${baseURL}/api/admin/professionals/${applicantId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ decision: 'verify', notes: 'Credentials confirmed via State Medical Board' })
    });
    assert.equal(approveRes.status, 200);

    // 5. Public directory returns verified doctor with photo
    const directoryRes = await fetch(`${baseURL}/api/professionals`);
    assert.equal(directoryRes.status, 200);
    const dirData = await directoryRes.json();
    const inDirectory = dirData.professionals.find(p => p.id === applicantId);
    assert.ok(inDirectory);
    assert.equal(inDirectory.imageUrl, proPhoto);
  });

  test('34. Admin Direct Onboarding & Deletion of Clinicians', async () => {
    // 1. Admin login
    const adminLoginRes = await fetch(`${baseURL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    const { token: adminToken } = await adminLoginRes.json();

    // 2. Direct create clinician
    const directPhoto = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2';
    const createRes = await fetch(`${baseURL}/api/admin/professionals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        fullName: 'Dr. Michael Vance',
        displayName: 'Dr. Vance, PhD',
        email: 'michael.vance@clinic.org',
        password: 'DoctorPassword123!',
        licenseType: 'Licensed Clinical Psychologist',
        licenseNumber: 'PSY-110022',
        licenseJurisdiction: 'California, US',
        specialties: ['Youth Trauma', 'Mindfulness'],
        languages: ['English', 'Spanish'],
        bio: 'Youth psychologist dedicated to restorative mental health.',
        imageUrl: directPhoto
      })
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.professional.verificationStatus, 'verified');
    assert.equal(createData.professional.imageUrl, directPhoto);
    const createdId = createData.professional.id;

    // 3. Verified in public directory
    const dirRes = await fetch(`${baseURL}/api/professionals`);
    const dirData = await dirRes.json();
    assert.ok(dirData.professionals.some(p => p.id === createdId));

    // 4. Delete clinician
    const delRes = await fetch(`${baseURL}/api/admin/professionals/${createdId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(delRes.status, 200);

    // 5. Confirmed removed from directory
    const afterDirRes = await fetch(`${baseURL}/api/professionals`);
    const afterDirData = await afterDirRes.json();
    assert.ok(!afterDirData.professionals.some(p => p.id === createdId));
  });

  test('35. Standalone Message Editing - Author can edit message, non-author cannot, empty rejected', async () => {
    // 1. User 1 sends message to User 2
    const sendRes = await fetch(`${baseURL}/api/messages/${testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ content: 'Original message content before edit' })
    });
    assert.equal(sendRes.status, 201);
    const sendData = await sendRes.json();
    const msgId = sendData.message.id;
    assert.equal(sendData.message.isEdited, false);

    // 2. User 2 (recipient, non-author) attempts to edit User 1's message -> must be rejected with 403
    const unauthorizedEditRes = await fetch(`${baseURL}/api/messages/message/${msgId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({ content: 'Hacked content by recipient' })
    });
    assert.equal(unauthorizedEditRes.status, 403);

    // 3. User 1 attempts to edit with empty string -> must fail with 400
    const emptyEditRes = await fetch(`${baseURL}/api/messages/message/${msgId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ content: '   ' })
    });
    assert.equal(emptyEditRes.status, 400);

    // 4. User 1 (author) edits message with valid updated content -> succeeds with 200
    const editRes = await fetch(`${baseURL}/api/messages/message/${msgId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ content: 'Corrected message content after editorial edit' })
    });
    assert.equal(editRes.status, 200);
    const editData = await editRes.json();
    assert.equal(editData.success, true);
    assert.equal(editData.message.content, 'Corrected message content after editorial edit');
    assert.equal(editData.message.isEdited, true);
    assert.ok(editData.message.editedAt);

    // 5. Verify message in conversation listing reflects edited text and isEdited flag
    const listRes = await fetch(`${baseURL}/api/messages/${testConversationId}/messages`, {
      headers: { 'x-anon-token': user1Token }
    });
    const listData = await listRes.json();
    const fetchedMsg = listData.messages.find(m => m.id === msgId);
    assert.ok(fetchedMsg);
    assert.equal(fetchedMsg.content, 'Corrected message content after editorial edit');
    assert.equal(fetchedMsg.isEdited, true);
  });

  test('36. Standalone Post and Reply Editing - Author can edit post and reply, non-author cannot', async () => {
    // 1. User 1 creates post
    const postRes = await fetch(`${baseURL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        title: 'Original Post Title',
        content: 'Original post content describing a challenge.',
        category: 'Personal Growth'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    const testPostId = postData.post.id;

    // 2. User 2 (non-author) attempts to edit User 1's post -> rejected 403
    const failPostEdit = await fetch(`${baseURL}/api/posts/${testPostId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({ title: 'Malicious title change' })
    });
    assert.equal(failPostEdit.status, 403);

    // 3. User 1 edits their post -> succeeds 200
    const editPostRes = await fetch(`${baseURL}/api/posts/${testPostId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({
        title: 'Updated Question Title by Author',
        content: 'Updated post content by author after careful reflection.'
      })
    });
    assert.equal(editPostRes.status, 200);
    const editPostData = await editPostRes.json();
    assert.equal(editPostData.post.title, 'Updated Question Title by Author');
    assert.equal(editPostData.post.content, 'Updated post content by author after careful reflection.');
    assert.equal(editPostData.post.isEdited, true);

    // 4. User 2 creates reply on post
    const replyRes = await fetch(`${baseURL}/api/posts/${testPostId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({
        content: 'Original reply from user 2'
      })
    });
    assert.equal(replyRes.status, 201);
    const replyData = await replyRes.json();
    const testReplyId = replyData.reply.id;

    // 5. User 1 attempts to edit User 2's reply -> rejected 403
    const failReplyEdit = await fetch(`${baseURL}/api/posts/replies/${testReplyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user1Token
      },
      body: JSON.stringify({ content: 'Attempt to tamper with reply' })
    });
    assert.equal(failReplyEdit.status, 403);

    // 6. User 2 edits their own reply -> succeeds 200
    const editReplyRes = await fetch(`${baseURL}/api/posts/replies/${testReplyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': user2Token
      },
      body: JSON.stringify({ content: 'Carefully revised reply from user 2' })
    });
    assert.equal(editReplyRes.status, 200);
    const editReplyData = await editReplyRes.json();
    assert.equal(editReplyData.reply.content, 'Carefully revised reply from user 2');
    assert.equal(editReplyData.reply.isEdited, true);
  });
});
