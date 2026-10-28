import mongoose from 'mongoose';
import xss from 'xss';
import crypto from 'crypto';
import { Community } from '../models/Community.js';
import { CommunityMembership } from '../models/CommunityMembership.js';
import { Post } from '../models/Post.js';
import { Reply } from '../models/Reply.js';
import { AnonymousSession } from '../models/AnonymousSession.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .substring(0, 50);
}

export async function listCommunities(req, res, next) {
  try {
    const { search, topic, sort = 'popular', page = 1, limit = 20 } = req.query;
    const query = { isPrivate: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (topic && topic !== 'All') {
      query.topic = topic;
    }

    let sortOptions = { memberCount: -1, createdAt: -1 };
    if (sort === 'recent') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'active') {
      sortOptions = { postCount: -1 };
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [communities, total] = await Promise.all([
      Community.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(take)
        .populate('creator', 'username'),
      Community.countDocuments(query)
    ]);

    // Check membership if user is logged in
    let userMemberships = new Set();
    if (req.identity) {
      const memberships = await CommunityMembership.find({
        identity: req.identity._id,
        community: { $in: communities.map(c => c._id) }
      }).select('community');
      userMemberships = new Set(memberships.map(m => m.community.toString()));
    }

    const formatted = communities.map(c => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      topic: c.topic,
      rules: c.rules,
      creator: c.creator?.username || 'Anonymous',
      creatorId: c.creator?._id,
      memberCount: c.memberCount,
      postCount: c.postCount,
      isMember: userMemberships.has(c._id.toString()),
      createdAt: c.createdAt
    }));

    res.json({
      success: true,
      communities: formatted,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / take)
    });
  } catch (error) {
    next(error);
  }
}

export async function createCommunity(req, res, next) {
  try {
    const { name, description, topic, rules, isPrivate } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Community name must be at least 2 characters.' });
    }

    if (!description || description.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Description must be at least 5 characters.' });
    }

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Topic category is required.' });
    }

    const sanitizedName = xss(name.trim());
    const sanitizedDesc = xss(description.trim());
    let baseSlug = slugify(sanitizedName);
    if (!baseSlug) baseSlug = 'community-' + Math.floor(1000 + Math.random() * 9000);

    let slug = baseSlug;
    let counter = 1;
    while (await Community.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const cleanedRules = Array.isArray(rules) && rules.length > 0
      ? rules.map(r => xss(String(r).trim())).filter(Boolean)
      : [
          'Be respectful and kind to others.',
          'Do not share personal identifying information.',
          'No hate speech, threats, or harassment.'
        ];

    const isPriv = Boolean(isPrivate);
    const inviteCode = isPriv
      ? (req.body.inviteCode?.trim() || crypto.randomBytes(6).toString('hex'))
      : null;

    const community = await Community.create({
      name: sanitizedName,
      slug,
      description: sanitizedDesc,
      topic: xss(topic.trim()),
      rules: cleanedRules,
      creator: req.identity._id,
      isPrivate: isPriv,
      inviteCode,
      memberCount: 1
    });

    // Automatically make creator a member with role 'creator'
    await CommunityMembership.create({
      community: community._id,
      identity: req.identity._id,
      role: 'creator'
    });

    res.status(201).json({
      success: true,
      community: {
        id: community._id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        topic: community.topic,
        rules: community.rules,
        memberCount: community.memberCount,
        isMember: true,
        isPrivate: community.isPrivate,
        inviteCode: isPriv ? community.inviteCode : undefined,
        createdAt: community.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCommunity(req, res, next) {
  try {
    const { identifier } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const community = await Community.findOne(query).populate('creator', 'username');
    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }

    let isMember = false;
    let userRole = null;
    if (req.identity) {
      const membership = await CommunityMembership.findOne({
        community: community._id,
        identity: req.identity._id
      });
      if (membership) {
        isMember = true;
        userRole = membership.role;
      }
    }

    // Private communities: protect all private metadata from non-members
    if (community.isPrivate && !isMember) {
      return res.status(403).json({
        success: false,
        error: 'This is a private community. Membership or an authorized invitation is required.',
        isPrivate: true
      });
    }

    const isCreator = req.identity && community.creator?._id?.toString() === req.identity._id?.toString();

    res.json({
      success: true,
      community: {
        id: community._id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        topic: community.topic,
        rules: community.rules,
        creator: community.creator?.username || 'Anonymous',
        creatorId: community.creator?._id,
        isCreator,
        memberCount: community.memberCount,
        postCount: community.postCount,
        isMember,
        userRole,
        isPrivate: community.isPrivate,
        inviteCode: isCreator && community.isPrivate ? community.inviteCode : undefined,
        createdAt: community.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCommunity(req, res, next) {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }

    if (community.creator.toString() !== req.identity._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the community creator can update its details.' });
    }

    const { description, rules } = req.body;
    if (description) community.description = xss(description.trim());
    if (Array.isArray(rules)) {
      community.rules = rules.map(r => xss(String(r).trim())).filter(Boolean);
    }

    await community.save();

    res.json({
      success: true,
      message: 'Community details updated.',
      community: {
        id: community._id,
        description: community.description,
        rules: community.rules
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function joinCommunity(req, res, next) {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }

    const existing = await CommunityMembership.findOne({
      community: community._id,
      identity: req.identity._id
    });

    if (existing) {
      const currentCount = await CommunityMembership.countDocuments({ community: community._id });
      return res.json({
        success: true,
        message: 'You are already a member of this community.',
        memberCount: currentCount,
        isMember: true
      });
    }

    // Enforce private-community admission rules
    if (community.isPrivate) {
      const { inviteCode } = req.body || {};
      const hasValidInvite = Boolean(
        inviteCode &&
        community.inviteCode &&
        String(inviteCode).trim() === community.inviteCode
      );

      const approvedRequest = community.joinRequests?.find(
        r => r.identity.toString() === req.identity._id.toString() && r.status === 'approved'
      );

      if (!hasValidInvite && !approvedRequest) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: This is a private community. Admission requires an authorized invitation code or owner approval.'
        });
      }

      // If approved via join request, remove the request
      if (approvedRequest) {
        community.joinRequests = community.joinRequests.filter(
          r => r.identity.toString() !== req.identity._id.toString()
        );
      }
    }

    await CommunityMembership.create({
      community: community._id,
      identity: req.identity._id,
      role: 'member'
    });

    const newCount = await CommunityMembership.countDocuments({ community: community._id });
    community.memberCount = newCount;
    await community.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`community:${community._id}`).emit('community_member_count_updated', {
        communityId: community._id.toString(),
        memberCount: community.memberCount
      });
      if (!community.isPrivate) {
        io.emit('communities_stream', {
          communityId: community._id.toString(),
          memberCount: community.memberCount
        });
      }
    }

    res.json({
      success: true,
      message: `Joined ${community.name}.`,
      memberCount: community.memberCount,
      isMember: true
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveCommunity(req, res, next) {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }

    const deleted = await CommunityMembership.findOneAndDelete({
      community: community._id,
      identity: req.identity._id
    });

    const remainingCount = await CommunityMembership.countDocuments({ community: community._id });
    community.memberCount = remainingCount;
    await community.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`community:${community._id}`).emit('community_member_count_updated', {
        communityId: community._id.toString(),
        memberCount: community.memberCount
      });
      if (!community.isPrivate) {
        io.emit('communities_stream', {
          communityId: community._id.toString(),
          memberCount: community.memberCount
        });
      }

      // Revoke private socket access for all sockets belonging to this user
      const userSockets = io.sockets.adapter.rooms.get(`user:${req.identity._id}`);
      if (userSockets) {
        const communityRoom = `community:${community._id}`;
        const communityPosts = await Post.find({ community: community._id }).select('_id');
        const postRoomNames = communityPosts.map(p => `post:${p._id}`);

        for (const socketId of userSockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s) {
            s.leave(communityRoom);
            for (const pr of postRoomNames) {
              s.leave(pr);
            }
            s.emit('community_access_revoked', {
              communityId: community._id.toString(),
              communityName: community.name
            });
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Left ${community.name}.`,
      memberCount: community.memberCount,
      isMember: false
    });
  } catch (error) {
    next(error);
  }
}

export async function removeCommunityPost(req, res, next) {
  try {
    const { communityId, postId } = req.params;
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }

    // Check if requester is creator or community moderator
    const isCreator = community.creator.toString() === req.identity._id.toString();
    if (!isCreator) {
      const membership = await CommunityMembership.findOne({
        community: community._id,
        identity: req.identity._id,
        role: { $in: ['creator', 'moderator'] }
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Not authorized to moderate this community.' });
      }
    }

    const post = await Post.findOne({ _id: postId, community: community._id });
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found in this community.' });
    }

    post.isDeleted = true;
    post.deletedReason = isCreator ? 'Removed by community owner' : 'Removed by community moderator';
    await post.save();

    // Also mark its replies as deleted
    await Reply.updateMany({ post: post._id }, { $set: { isDeleted: true } });

    // Decrement community post count
    await Community.findByIdAndUpdate(community._id, { $inc: { postCount: -1 } });

    const io = req.app.get('io');
    if (io) {
      const delPayload = { postId: post._id.toString() };
      io.to(`post:${post._id}`).emit('post_deleted', delPayload);
      io.to(`community:${community._id}`).emit('post_deleted', delPayload);
    }

    res.json({ success: true, message: 'Message removed from community successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function getCommunityMembers(req, res, next) {
  try {
    const { identifier } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const community = await Community.findOne(query);
    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }

    // Only the community creator / owner can view the joined members roster
    const isCreator = req.identity && community.creator.toString() === req.identity._id.toString();
    if (!isCreator) {
      return res.status(403).json({
        success: false,
        error: 'Only the community owner can view the list of joined anonymous members.'
      });
    }

    const memberships = await CommunityMembership.find({ community: community._id })
      .populate('identity', 'username avatarSeed bio createdAt status')
      .sort({ createdAt: 1 });

    const activeMembers = [];
    for (const m of memberships) {
      if (!m.identity || m.identity.status !== 'active') continue;
      const session = await AnonymousSession.findOne({
        identities: m.identity._id,
        status: 'active',
        expiresAt: { $gt: new Date() }
      });
      if (session) {
        activeMembers.push({
          id: m._id,
          identityId: m.identity._id,
          username: m.identity.username,
          avatarSeed: m.identity.avatarSeed,
          bio: m.identity.bio,
          role: m.role || (m.identity._id.toString() === community.creator.toString() ? 'creator' : 'member'),
          joinedAt: m.joinedAt || m.createdAt
        });
      }
    }

    res.json({
      success: true,
      community: {
        id: community._id,
        name: community.name,
        slug: community.slug
      },
      memberCount: activeMembers.length,
      members: activeMembers
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request admission to a private community
 */
export async function requestCommunityAccess(req, res, next) {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }
    if (!community.isPrivate) {
      return res.status(400).json({ success: false, error: 'This is a public community. You can join directly.' });
    }

    const isMember = await CommunityMembership.findOne({
      community: community._id,
      identity: req.identity._id
    });
    if (isMember) {
      return res.status(400).json({ success: false, error: 'You are already a member of this community.' });
    }

    const existingReq = community.joinRequests?.find(
      r => r.identity.toString() === req.identity._id.toString() && r.status === 'pending'
    );
    if (existingReq) {
      return res.json({ success: true, message: 'Join request already submitted. Awaiting community owner review.' });
    }

    community.joinRequests.push({ identity: req.identity._id, status: 'pending' });
    await community.save();

    res.status(201).json({
      success: true,
      message: 'Join request submitted to community owner.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List pending join requests for a private community (owner only)
 */
export async function listCommunityJoinRequests(req, res, next) {
  try {
    const commId = req.params.id || req.params.identifier;
    const community = (mongoose.Types.ObjectId.isValid(commId))
      ? await Community.findById(commId).populate('joinRequests.identity', 'username avatarSeed createdAt')
      : await Community.findOne({ slug: commId }).populate('joinRequests.identity', 'username avatarSeed createdAt');

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }
    if (community.creator.toString() !== req.identity._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the community owner can view join requests.' });
    }
    const pending = (community.joinRequests || []).filter(r => r.status === 'pending');
    res.json({
      success: true,
      requests: pending.map(r => ({
        id: r._id,
        identity: {
          id: r.identity?._id?.toString(),
          username: r.identity?.username || 'Anonymous'
        },
        createdAt: r.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Review a join request (owner only)
 */
export async function reviewCommunityJoinRequest(req, res, next) {
  try {
    const { id, requestId } = req.params;
    const decision = req.body.decision || req.body.action;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be "approve" or "reject".' });
    }

    const community = (mongoose.Types.ObjectId.isValid(id))
      ? await Community.findById(id)
      : await Community.findOne({ slug: id });

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found.' });
    }
    if (community.creator.toString() !== req.identity._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the community owner can review join requests.' });
    }

    const request = community.joinRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Join request not found.' });
    }

    if (decision === 'approve') {
      request.status = 'approved';
      // Automatically create membership
      await CommunityMembership.findOneAndUpdate(
        { community: community._id, identity: request.identity },
        { role: 'member', joinedAt: new Date() },
        { upsert: true, new: true }
      );
      community.memberCount = await CommunityMembership.countDocuments({ community: community._id });
    } else {
      request.status = 'rejected';
    }

    await community.save();

    res.json({
      success: true,
      message: `Join request ${decision}ed successfully.`,
      decision
    });
  } catch (error) {
    next(error);
  }
}
