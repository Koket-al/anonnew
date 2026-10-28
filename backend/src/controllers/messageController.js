import xss from 'xss';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Block } from '../models/Block.js';
import { AnonymousIdentity } from '../models/AnonymousIdentity.js';
import { AnonymousSession } from '../models/AnonymousSession.js';

export async function requestConversation(req, res, next) {
  try {
    const { targetUsername, targetIdentityId, initialNote, relatedPostId } = req.body;
    const currentId = req.identity._id;

    if (!targetIdentityId && !targetUsername) {
      return res.status(400).json({
        success: false,
        error: 'Target identity is required to connect.'
      });
    }

    let targetIdentity;
    if (targetIdentityId) {
      targetIdentity = await AnonymousIdentity.findById(targetIdentityId);
    } else if (targetUsername) {
      targetIdentity = await AnonymousIdentity.findOne({ username: targetUsername.trim() });
    }

    if (!targetIdentity) {
      return res.status(404).json({
        success: false,
        error: 'Cannot connect: This user identity does not exist or has been removed.'
      });
    }

    if (targetIdentity.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot connect with this user because their identity is not active or has been suspended.'
      });
    }

    // Verify target identity belongs to an active, unexpired session (not removed/revoked)
    const activeSession = await AnonymousSession.findOne({
      identities: targetIdentity._id,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    if (!activeSession) {
      return res.status(400).json({
        success: false,
        error: 'Cannot connect with this user because their identity is no longer active or was removed.'
      });
    }

    if (targetIdentity._id.toString() === currentId.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot start a conversation with yourself.' });
    }

    // Prevent connecting with another identity belonging to the same user session
    if (req.session?.identities) {
      const ownsTarget = req.session.identities.some(
        id => (id._id || id).toString() === targetIdentity._id.toString()
      );
      if (ownsTarget) {
        return res.status(400).json({
          success: false,
          error: 'You cannot connect with another identity belonging to your own session.'
        });
      }
    }

    // Check if blocked in either direction
    const isBlocked = await Block.findOne({
      $or: [
        { blocker: currentId, blocked: targetIdentity._id },
        { blocker: targetIdentity._id, blocked: currentId }
      ]
    });

    if (isBlocked) {
      return res.status(403).json({ success: false, error: 'Cannot connect with this user due to privacy preferences or blocks.' });
    }

    // Check existing conversation between the two
    let conversation = await Conversation.findOne({
      participants: { $all: [currentId, targetIdentity._id] }
    });

    if (conversation) {
      if (conversation.status === 'blocked') {
        return res.status(403).json({ success: false, error: 'This conversation is currently blocked.' });
      }
      return res.json({
        success: true,
        conversationId: conversation._id,
        status: conversation.status,
        message: 'Existing conversation found.'
      });
    }

    // Create new connection request
    conversation = await Conversation.create({
      participants: [currentId, targetIdentity._id],
      requestedBy: currentId,
      status: 'pending',
      initialNote: initialNote ? xss(initialNote.trim().slice(0, 300)) : '',
      relatedPost: relatedPostId || null
    });

    const io = req.app.get('io');
    if (io) {
      // Real-time notification to recipient
      io.to(`user:${targetIdentity._id}`).emit('connection_request_received', {
        conversationId: conversation._id.toString(),
        sender: {
          id: req.identity._id.toString(),
          username: req.identity.username,
          avatarSeed: req.identity.avatarSeed
        },
        initialNote: conversation.initialNote,
        status: 'pending',
        createdAt: conversation.createdAt
      });

      // Real-time update for sender
      io.to(`user:${currentId}`).emit('connection_request_sent', {
        conversationId: conversation._id.toString(),
        target: {
          id: targetIdentity._id.toString(),
          username: targetIdentity.username,
          avatarSeed: targetIdentity.avatarSeed
        },
        status: 'pending',
        createdAt: conversation.createdAt
      });
    }

    res.status(201).json({
      success: true,
      conversationId: conversation._id,
      status: conversation.status,
      message: 'Connection request sent. The recipient will be able to review and accept.'
    });
  } catch (error) {
    next(error);
  }
}

export async function respondToRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const currentId = req.identity._id;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation request not found.' });
    }

    if (!conversation.participants.some(p => p.toString() === currentId.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized for this conversation.' });
    }

    if (conversation.requestedBy.toString() === currentId.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot accept your own request.' });
    }

    if (action === 'accept') {
      const otherId = conversation.participants.find(p => p.toString() !== currentId.toString());
      const otherIdentity = await AnonymousIdentity.findById(otherId);
      if (!otherIdentity || otherIdentity.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Cannot accept request: The other user identity is no longer active or was removed.'
        });
      }

      const otherSession = await AnonymousSession.findOne({
        identities: otherId,
        status: 'active',
        expiresAt: { $gt: new Date() }
      });
      if (!otherSession) {
        return res.status(400).json({
          success: false,
          error: 'Cannot accept request: The other user has ended their session or removed this identity.'
        });
      }

      conversation.status = 'accepted';
      await conversation.save();

      const io = req.app.get('io');
      if (io) {
        const updatePayload = {
          conversationId: conversation._id.toString(),
          status: 'accepted',
          acceptedBy: {
            id: currentId.toString(),
            username: req.identity.username
          }
        };
        io.to(`user:${conversation.requestedBy}`).emit('connection_status_updated', updatePayload);
        io.to(`user:${currentId}`).emit('connection_status_updated', updatePayload);
        io.to(`user:${conversation.requestedBy}`).emit('connection_accepted_notification', {
          conversationId: conversation._id.toString(),
          partnerUsername: req.identity.username,
          message: `@${req.identity.username} accepted your private connection request! You can now exchange messages.`
        });
      }

      return res.json({ success: true, status: 'accepted', message: 'Connection request accepted.' });
    } else if (action === 'reject') {
      conversation.status = 'rejected';
      await conversation.save();

      const io = req.app.get('io');
      if (io) {
        const updatePayload = {
          conversationId: conversation._id.toString(),
          status: 'rejected'
        };
        io.to(`user:${conversation.requestedBy}`).emit('connection_status_updated', updatePayload);
        io.to(`user:${currentId}`).emit('connection_status_updated', updatePayload);
      }

      return res.json({ success: true, status: 'rejected', message: 'Connection request declined.' });
    }

    res.status(400).json({ success: false, error: 'Invalid action. Must be accept or reject.' });
  } catch (error) {
    next(error);
  }
}

export async function listConversations(req, res, next) {
  try {
    const currentId = req.identity._id;

    const conversations = await Conversation.find({
      participants: currentId,
      status: { $ne: 'blocked' }
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'username avatarSeed')
      .populate('requestedBy', 'username');

    const formatted = await Promise.all(
      conversations.map(async conv => {
        const partner = conv.participants.find(p => p._id.toString() !== currentId.toString());
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          recipient: currentId,
          readAt: null
        });

        return {
          id: conv._id,
          status: conv.status,
          partner: partner ? {
            id: partner._id,
            username: partner.username,
            avatarSeed: partner.avatarSeed
          } : { username: 'Anonymous' },
          requestedByMe: conv.requestedBy?._id?.toString() === currentId.toString(),
          initialNote: conv.initialNote,
          lastMessage: conv.lastMessage?.text ? {
            text: conv.lastMessage.text,
            isMine: conv.lastMessage.sender?.toString() === currentId.toString(),
            createdAt: conv.lastMessage.createdAt
          } : null,
          unreadCount,
          updatedAt: conv.updatedAt
        };
      })
    );

    res.json({
      success: true,
      conversations: formatted
    });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const { id } = req.params;
    const currentId = req.identity._id;

    const conversation = await Conversation.findById(id).populate('participants', 'username avatarSeed');
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => p._id.toString() === currentId.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Access denied. You are not a participant in this conversation.' });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .populate('sender', 'username avatarSeed');

    // Mark unread messages to current user as read
    const now = new Date();
    const updateResult = await Message.updateMany(
      { conversation: conversation._id, recipient: currentId, readAt: null },
      { $set: { readAt: now } }
    );

    if (updateResult.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${conversation._id}`).emit('messages_read', {
          conversationId: conversation._id.toString(),
          readAt: now,
          readerId: currentId.toString()
        });
      }
    }

    const partner = conversation.participants.find(p => p._id.toString() !== currentId.toString());

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        status: conversation.status,
        partner: partner ? {
          id: partner._id,
          username: partner.username,
          avatarSeed: partner.avatarSeed
        } : null,
        requestedByMe: conversation.requestedBy.toString() === currentId.toString(),
        initialNote: conversation.initialNote
      },
      messages: messages.map(m => ({
        id: m._id.toString(),
        content: m.content,
        senderId: m.sender?._id?.toString(),
        senderUsername: m.sender?.username || 'Anonymous',
        isMine: m.sender?._id?.toString() === currentId.toString(),
        readAt: m.readAt,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const currentId = req.identity._id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === currentId.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'You are not a participant in this conversation.' });
    }

    if (conversation.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: `Cannot send message. Conversation status is "${conversation.status}".`
      });
    }

    const recipientId = conversation.participants.find(p => p.toString() !== currentId.toString());

    // Check if recipient identity exists and is active
    const recipientIdentity = await AnonymousIdentity.findById(recipientId);
    if (!recipientIdentity || recipientIdentity.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot send message because recipient identity is no longer active or was removed.'
      });
    }

    const recipientSession = await AnonymousSession.findOne({
      identities: recipientId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });
    if (!recipientSession) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send message because recipient has removed their identity or ended their session.'
      });
    }

    // Check if blocked
    const isBlocked = await Block.findOne({
      $or: [
        { blocker: currentId, blocked: recipientId },
        { blocker: recipientId, blocked: currentId }
      ]
    });
    if (isBlocked) {
      return res.status(403).json({ success: false, error: 'Communication blocked.' });
    }

    const sanitizedContent = xss(content.trim().slice(0, 3000));

    const message = await Message.create({
      conversation: conversation._id,
      sender: currentId,
      recipient: recipientId,
      content: sanitizedContent
    });

    conversation.lastMessage = {
      text: sanitizedContent.slice(0, 100),
      sender: currentId,
      createdAt: message.createdAt
    };
    conversation.updatedAt = new Date();
    await conversation.save();

    const io = req.app.get('io');
    if (io) {
      const messagePayload = {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: message.content,
        senderId: currentId.toString(),
        senderUsername: req.identity.username,
        readAt: null,
        createdAt: message.createdAt
      };

      // Broadcast to active conversation room
      io.to(`conversation:${conversation._id}`).emit('new_message', messagePayload);

      // Notify recipient in their personal room
      io.to(`user:${recipientId}`).emit('incoming_message_notification', {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        senderId: currentId.toString(),
        senderUsername: req.identity.username,
        content: sanitizedContent,
        createdAt: message.createdAt
      });

      // Notify recipient that conversation list changed
      io.to(`user:${recipientId}`).emit('conversation_updated', {
        conversationId: conversation._id.toString(),
        lastMessage: messagePayload
      });
    }

    res.status(201).json({
      success: true,
      message: {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: message.content,
        senderId: currentId.toString(),
        senderUsername: req.identity.username,
        isMine: true,
        readAt: null,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function blockUser(req, res, next) {
  try {
    const { targetIdentityId, conversationId } = req.body;
    const currentId = req.identity._id;

    if (!targetIdentityId) {
      return res.status(400).json({ success: false, error: 'Target identity is required.' });
    }

    await Block.findOneAndUpdate(
      { blocker: currentId, blocked: targetIdentityId },
      { blocker: currentId, blocked: targetIdentityId },
      { upsert: true }
    );

    if (conversationId) {
      await Conversation.findByIdAndUpdate(conversationId, { status: 'blocked' });
    }

    res.json({
      success: true,
      message: 'User blocked. They will not be able to send you messages or requests.'
    });
  } catch (error) {
    next(error);
  }
}

export async function closeConversation(req, res, next) {
  try {
    const { id } = req.params;
    const currentId = req.identity._id;

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.participants.some(p => p.toString() === currentId.toString())) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    conversation.status = 'closed';
    await conversation.save();

    res.json({ success: true, message: 'Conversation ended.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const messageId = req.params.messageId || req.params.id;
    const currentId = req.identity._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }

    if (message.sender.toString() !== currentId.toString()) {
      return res.status(403).json({ success: false, error: 'You can only delete your own messages.' });
    }

    const conversationId = message.conversation;
    await Message.findByIdAndDelete(messageId);

    // Update conversation lastMessage preview
    const lastMsg = await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 });
    if (lastMsg) {
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
          text: lastMsg.content.slice(0, 100),
          sender: lastMsg.sender,
          createdAt: lastMsg.createdAt
        }
      });
    } else {
      await Conversation.findByIdAndUpdate(conversationId, {
        $unset: { lastMessage: 1 }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message_deleted', {
        conversationId: conversationId.toString(),
        messageId: messageId.toString()
      });
    }

    res.json({
      success: true,
      messageId,
      message: 'Message deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
