import { hashToken } from '../services/identityService.js';
import { AnonymousSession } from '../models/AnonymousSession.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ListeningRoom } from '../models/ListeningRoom.js';
import xss from 'xss';
import crypto from 'crypto';

export function setupSocketIO(io) {
  // Socket authentication middleware (supports both authenticated identities and guest readers)
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
      next();
    } catch {
      next();
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.identity ? socket.identity._id.toString() : null;
    const username = socket.identity ? socket.identity.username : 'Anonymous';

    if (userId) {
      // Join personal notification channel for connections, replies, private messages
      socket.join(`user:${userId}`);
    }

    // Join / leave public discussion streams
    socket.on('join_stream', () => {
      socket.join('posts_stream');
    });

    socket.on('leave_stream', () => {
      socket.leave('posts_stream');
    });

    // Join / leave specific post discussion for real-time replies & reactions
    socket.on('join_post', ({ postId }) => {
      if (postId) {
        socket.join(`post:${postId}`);
      }
    });

    socket.on('leave_post', ({ postId }) => {
      if (postId) {
        socket.leave(`post:${postId}`);
      }
    });

    // Join / leave specific community for real-time questions & updates
    socket.on('join_community', ({ communityId }) => {
      if (communityId) {
        socket.join(`community:${communityId}`);
      }
    });

    socket.on('leave_community', ({ communityId }) => {
      if (communityId) {
        socket.leave(`community:${communityId}`);
      }
    });

    // Join private conversation room
    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        if (!userId) return socket.emit('error', 'Authentication required');
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

    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Real-time private message delivery
    socket.on('send_private_message', async ({ conversationId, content }) => {
      try {
        if (!userId || !socket.identity) return;
        if (!content || !content.trim()) return;

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

        // Broadcast to conversation room and to recipient's personal notification room
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

    // Real-time read receipts
    socket.on('mark_messages_read', async ({ conversationId }) => {
      try {
        if (!conversationId) return;
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

    // Join Listening Room
    socket.on('join_listening_room', async ({ roomId }) => {
      try {
        const room = await ListeningRoom.findById(roomId);
        if (!room || room.isClosed) return;

        const roomChannel = `listening_room:${roomId}`;
        if (socket.rooms && socket.rooms.has(roomChannel)) {
          return;
        }

        socket.join(roomChannel);
        socket.currentRoomId = roomId;

        if (!room.activeParticipants.some(p => p.toString() === userId)) {
          room.activeParticipants.push(socket.identity._id);
          await room.save();
        }

        io.to(roomChannel).emit('user_joined_room', {
          username,
          userId,
          participantCount: room.activeParticipants.length
        });
      } catch (err) {
        console.error('[Socket join_listening_room error]:', err.message);
      }
    });

    // Real-time Listening Room Message
    socket.on('send_room_message', async ({ roomId, content }) => {
      try {
        if (!content || !content.trim()) return;

        const room = await ListeningRoom.findById(roomId);
        if (!room || room.isClosed) return;

        const cleanContent = xss(content.trim().slice(0, 1500));
        const messageId = crypto.randomUUID();

        io.to(`listening_room:${roomId}`).emit('new_room_message', {
          id: messageId,
          roomId,
          content: cleanContent,
          senderUsername: username,
          senderId: userId,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('[Socket send_room_message error]:', err.message);
      }
    });

    socket.on('leave_listening_room', async ({ roomId }) => {
      try {
        socket.leave(`listening_room:${roomId}`);
        const room = await ListeningRoom.findById(roomId);
        if (room) {
          room.activeParticipants = room.activeParticipants.filter(p => p.toString() !== userId);
          await room.save();

          io.to(`listening_room:${roomId}`).emit('user_left_room', {
            username,
            userId,
            participantCount: room.activeParticipants.length
          });
        }
      } catch (err) {
        console.error('[Socket leave_listening_room error]:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      if (socket.currentRoomId) {
        try {
          const room = await ListeningRoom.findById(socket.currentRoomId);
          if (room) {
            room.activeParticipants = room.activeParticipants.filter(p => p.toString() !== userId);
            await room.save();
            io.to(`listening_room:${socket.currentRoomId}`).emit('user_left_room', {
              username,
              userId,
              participantCount: room.activeParticipants.length
            });
          }
        } catch {
          // ignore cleanup errors on disconnect
        }
      }
    });
  });
}
