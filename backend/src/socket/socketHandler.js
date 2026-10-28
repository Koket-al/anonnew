import { hashToken } from '../services/identityService.js';
import { AnonymousSession } from '../models/AnonymousSession.js';
import { Community } from '../models/Community.js';
import { CommunityMembership } from '../models/CommunityMembership.js';
import { Post } from '../models/Post.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ListeningRoom } from '../models/ListeningRoom.js';
import xss from 'xss';
import crypto from 'crypto';

// ─── In-memory join locks to prevent race-condition capacity bypass ──────────
// Maps roomId -> Set of socketIds currently processing a join
const joinLocks = new Map();

function acquireJoinLock(roomId, socketId) {
  if (!joinLocks.has(roomId)) joinLocks.set(roomId, new Set());
  const lock = joinLocks.get(roomId);
  if (lock.has(socketId)) return false; // already locked
  lock.add(socketId);
  return true;
}
function releaseJoinLock(roomId, socketId) {
  joinLocks.get(roomId)?.delete(socketId);
}

// ─── Per-socket message-rate limiter ─────────────────────────────────────────
const messageCounts = new Map(); // socketId -> { count, resetAt }
const MESSAGE_RATE_WINDOW_MS = 10_000; // 10 seconds
const MESSAGE_RATE_MAX = 8;            // max messages per window

function checkMessageRate(socketId) {
  const now = Date.now();
  const entry = messageCounts.get(socketId) || { count: 0, resetAt: now + MESSAGE_RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + MESSAGE_RATE_WINDOW_MS;
  }
  entry.count += 1;
  messageCounts.set(socketId, entry);
  return entry.count <= MESSAGE_RATE_MAX;
}

export function setupSocketIO(io) {
  // ── Socket authentication middleware ──────────────────────────────────────
  // Resolves the verified server-side identity for each connecting socket.
  // Guests (no token) are allowed to connect with socket.identity = null.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-anon-token'];
      if (token) {
        const tokenHash = hashToken(token);
        const session = await AnonymousSession.findOne({
          tokenHash,
          status: 'active',
          expiresAt: { $gt: new Date() }
        }).populate('identity');

        if (session && session.identity && session.identity.status !== 'suspended') {
          socket.identity = session.identity;
        }
      }
      // Always allow connection — guest access is intentional for public rooms
      next();
    } catch {
      next(); // don't block connection on DB errors; individual events handle auth
    }
  });

  io.on('connection', (socket) => {
    // userId and username are derived ONLY from the server-verified identity.
    // Event payloads must never be trusted for identity.
    const userId = socket.identity ? socket.identity._id.toString() : null;
    const username = socket.identity ? socket.identity.username : 'Anonymous';

    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Track which listening room this socket is in (at most one)
    socket.currentRoomId = null;

    // ── Public stream ────────────────────────────────────────────────────────
    socket.on('join_stream', () => {
      socket.join('posts_stream');
    });

    socket.on('leave_stream', () => {
      socket.leave('posts_stream');
    });

    // ── Post room ────────────────────────────────────────────────────────────
    // A user may join a post room only if they can access the post.
    // For community posts that requirement is enforced; public posts are open.
    socket.on('join_post', async ({ postId } = {}) => {
      try {
        if (!postId || typeof postId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(postId)) {
          return socket.emit('error', 'Invalid post ID.');
        }

        const post = await Post.findById(postId).populate('community');
        if (!post || post.isDeleted) {
          return socket.emit('error', 'Post not found.');
        }

        // If the post belongs to a community, verify membership
        if (post.community) {
          const community = post.community;
          // All community posts require membership (public and private communities alike)
          if (!userId) {
            return socket.emit('error', 'Authentication required to join community post room.');
          }
          const membership = await CommunityMembership.findOne({
            community: community._id,
            identity: socket.identity._id
          });
          if (!membership) {
            return socket.emit('error', 'Join the community to participate in this post room.');
          }
        }
        // Public posts (no community) are open to everyone

        socket.join(`post:${postId}`);
      } catch (err) {
        console.error('[Socket join_post error]:', err.message);
        socket.emit('error', 'Failed to join post room.');
      }
    });

    socket.on('leave_post', ({ postId } = {}) => {
      if (postId && typeof postId === 'string') {
        socket.leave(`post:${postId}`);
      }
    });

    // ── Community room ───────────────────────────────────────────────────────
    // Private communities: require membership.
    // Public communities: allow authenticated users; guests may observe.
    socket.on('join_community', async ({ communityId } = {}) => {
      try {
        if (!communityId || typeof communityId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(communityId)) {
          return socket.emit('error', 'Invalid community ID.');
        }

        const community = await Community.findById(communityId);
        if (!community) {
          return socket.emit('error', 'Community not found.');
        }

        if (community.isPrivate) {
          // Private community: must be an authenticated member
          if (!userId) {
            return socket.emit('error', 'Authentication required for private community.');
          }
          const membership = await CommunityMembership.findOne({
            community: community._id,
            identity: socket.identity._id
          });
          if (!membership) {
            return socket.emit('error', 'You must be a member to join this private community room.');
          }
        }

        socket.join(`community:${communityId}`);
      } catch (err) {
        console.error('[Socket join_community error]:', err.message);
        socket.emit('error', 'Failed to join community room.');
      }
    });

    socket.on('leave_community', ({ communityId } = {}) => {
      if (communityId && typeof communityId === 'string') {
        socket.leave(`community:${communityId}`);
      }
    });

    // ── Private conversation room ────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId } = {}) => {
      try {
        if (!userId) return socket.emit('error', 'Authentication required');
        if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) {
          return socket.emit('error', 'Invalid conversation ID.');
        }

        const conv = await Conversation.findById(conversationId);
        if (!conv) return socket.emit('error', 'Conversation not found');

        const isParticipant = conv.participants.some(p => p.toString() === userId);
        if (!isParticipant) {
          return socket.emit('error', 'Unauthorized to join this conversation');
        }

        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        socket.emit('error', 'Failed to join conversation');
      }
    });

    socket.on('leave_conversation', ({ conversationId } = {}) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // ── Real-time private message delivery ──────────────────────────────────
    socket.on('send_private_message', async ({ conversationId, content } = {}) => {
      try {
        if (!userId || !socket.identity) return;
        if (!content || !content.trim()) return;
        if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) return;

        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.status !== 'accepted') return;

        const isParticipant = conv.participants.some(p => p.toString() === userId);
        if (!isParticipant) return;

        const recipientId = conv.participants.find(p => p.toString() !== userId);
        const cleanContent = xss(content.trim().slice(0, 3000));

        const msg = await Message.create({
          conversation: conv._id,
          sender: socket.identity._id,
          recipient: recipientId,
          content: cleanContent
        });

        conv.lastMessage = {
          text: cleanContent.slice(0, 100),
          sender: socket.identity._id,
          createdAt: msg.createdAt
        };
        conv.updatedAt = new Date();
        await conv.save();

        const messagePayload = {
          id: msg._id.toString(),
          conversationId: conversationId.toString(),
          content: msg.content,
          senderId: userId,
          senderUsername: username,
          readAt: null,
          createdAt: msg.createdAt
        };

        io.to(`conversation:${conversationId}`).emit('new_message', messagePayload);
        io.to(`user:${recipientId}`).emit('incoming_message_notification', {
          id: msg._id.toString(),
          conversationId: conversationId.toString(),
          senderId: userId,
          senderUsername: username,
          content: cleanContent,
          createdAt: msg.createdAt
        });
        io.to(`user:${recipientId}`).emit('conversation_updated', {
          conversationId: conversationId.toString(),
          lastMessage: messagePayload
        });
      } catch (err) {
        console.error('[Socket send_private_message error]:', err.message);
      }
    });

    // ── Real-time read receipts ──────────────────────────────────────────────
    socket.on('mark_messages_read', async ({ conversationId } = {}) => {
      try {
        if (!userId || !socket.identity) return;
        if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) return;

        const conv = await Conversation.findById(conversationId);
        if (!conv) return;

        const isParticipant = conv.participants.some(p => p.toString() === userId);
        if (!isParticipant) return;

        const now = new Date();
        const updateResult = await Message.updateMany(
          { conversation: conversationId, recipient: socket.identity._id, readAt: null },
          { $set: { readAt: now } }
        );

        if (updateResult.modifiedCount > 0) {
          io.to(`conversation:${conversationId}`).emit('messages_read', {
            conversationId: conversationId.toString(),
            readAt: now,
            readerId: userId
          });
        }
      } catch (err) {
        console.error('[Socket mark_messages_read error]:', err.message);
      }
    });

    // ── Listening Room ───────────────────────────────────────────────────────
    socket.on('join_listening_room', async ({ roomId } = {}) => {
      if (!acquireJoinLock(roomId, socket.id)) return; // Prevent concurrent join spam
      try {
        if (!roomId || typeof roomId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(roomId)) {
          return socket.emit('error', 'Invalid room ID.');
        }

        const roomChannel = `listening_room:${roomId}`;

        // Idempotent: don't re-join if already in the room
        if (socket.rooms.has(roomChannel)) return;

        let participantCount = 0;
        if (userId) {
          // Check if user is already an active participant in DB
          let room = await ListeningRoom.findOne({ _id: roomId, isClosed: false });
          if (!room) return socket.emit('error', 'Room not found or closed.');

          const alreadyIn = room.activeParticipants.some(p => p.toString() === userId);
          if (!alreadyIn) {
            // Atomic add with capacity condition to prevent race-condition overflow
            const updated = await ListeningRoom.findOneAndUpdate(
              {
                _id: roomId,
                isClosed: false,
                activeParticipants: { $ne: socket.identity._id },
                $expr: { $lt: [{ $size: '$activeParticipants' }, '$maxParticipants'] }
              },
              { $addToSet: { activeParticipants: socket.identity._id } },
              { new: true }
            );

            if (!updated) {
              const check = await ListeningRoom.findById(roomId);
              if (!check || check.isClosed) {
                return socket.emit('error', 'Room not found or closed.');
              }
              if (check.activeParticipants.length >= check.maxParticipants) {
                return socket.emit('error', 'Room is at capacity.');
              }
              room = check;
            } else {
              room = updated;
            }
          }
          participantCount = room.activeParticipants.length;
        } else {
          // Guest: verify room exists, is open, and capacity limit
          const room = await ListeningRoom.findById(roomId);
          if (!room || room.isClosed) {
            return socket.emit('error', 'Room not found or closed.');
          }
          if (room.activeParticipants.length >= room.maxParticipants) {
            return socket.emit('error', 'Room is at capacity.');
          }
          participantCount = room.activeParticipants.length;
        }

        socket.join(roomChannel);
        socket.currentRoomId = roomId;

        io.to(roomChannel).emit('user_joined_room', {
          username,
          participantCount
          // userId deliberately omitted to preserve anonymity for guests
        });
      } catch (err) {
        console.error('[Socket join_listening_room error]:', err.message);
        socket.emit('error', 'Failed to join room.');
      } finally {
        releaseJoinLock(roomId, socket.id);
      }
    });

    // ── Listening Room Message ───────────────────────────────────────────────
    socket.on('send_room_message', async ({ roomId, content } = {}) => {
      try {
        if (!content || !content.trim()) return;
        if (!roomId || typeof roomId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(roomId)) {
          return socket.emit('error', 'Invalid room ID.');
        }

        // Enforce that sender has joined this specific room
        const roomChannel = `listening_room:${roomId}`;
        if (!socket.rooms.has(roomChannel)) {
          return socket.emit('error', 'You must join the room before sending messages.');
        }

        // Rate limiting
        if (!checkMessageRate(socket.id)) {
          return socket.emit('error', 'Message rate limit exceeded. Please slow down.');
        }

        const room = await ListeningRoom.findById(roomId);
        if (!room || room.isClosed) {
          return socket.emit('error', 'Room not found or closed.');
        }

        // Enforce message length and sanitize
        const cleanContent = xss(content.trim().slice(0, 1500));
        if (!cleanContent) return;

        const messageId = crypto.randomUUID();

        io.to(roomChannel).emit('new_room_message', {
          id: messageId,
          roomId,
          content: cleanContent,
          senderUsername: username, // server-derived — never from payload
          createdAt: new Date().toISOString()
          // senderId deliberately omitted to preserve anonymity
        });
      } catch (err) {
        console.error('[Socket send_room_message error]:', err.message);
      }
    });

    // ── Leave Listening Room ─────────────────────────────────────────────────
    socket.on('leave_listening_room', async ({ roomId } = {}) => {
      try {
        if (!roomId || typeof roomId !== 'string') return;
        socket.leave(`listening_room:${roomId}`);
        if (socket.currentRoomId === roomId) socket.currentRoomId = null;

        if (userId) {
          const room = await ListeningRoom.findById(roomId);
          if (room) {
            room.activeParticipants = room.activeParticipants.filter(p => p.toString() !== userId);
            await room.save();

            io.to(`listening_room:${roomId}`).emit('user_left_room', {
              username,
              participantCount: room.activeParticipants.length
            });
          }
        }
      } catch (err) {
        console.error('[Socket leave_listening_room error]:', err.message);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      // Clean up message rate limiter entry
      messageCounts.delete(socket.id);

      if (socket.currentRoomId && userId) {
        try {
          const room = await ListeningRoom.findById(socket.currentRoomId);
          if (room) {
            room.activeParticipants = room.activeParticipants.filter(p => p.toString() !== userId);
            await room.save();
            io.to(`listening_room:${socket.currentRoomId}`).emit('user_left_room', {
              username,
              participantCount: room.activeParticipants.length
            });
          }
        } catch {
          // Ignore cleanup errors on disconnect
        }
      }
    });
  });
}
