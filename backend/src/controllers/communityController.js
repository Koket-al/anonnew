import xss from 'xss';
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

    const community = await Community.create({
      name: sanitizedName,
      slug,
      description: sanitizedDesc,
      topic: xss(topic.trim()),
      rules: cleanedRules,
      creator: req.identity._id,
      isPrivate: Boolean(isPrivate),
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

    // Private communities: only members may see full details
    if (community.isPrivate && !isMember) {
      return res.status(403).json({
        success: false,
        error: 'This is a private community. You must be a member to view it.',
        community: {
          id: community._id,
          name: community.name,
          slug: community.slug,
          isPrivate: true,
          memberCount: community.memberCount
        }
      });
    }

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
        isCreator: req.identity && community.creator?._id?.toString() === req.identity._id?.toString(),
        memberCount: community.memberCount,
        postCount: community.postCount,
        isMember,
        userRole,
        isPrivate: community.isPrivate,
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
      io.emit('communities_stream', {
        communityId: community._id.toString(),
        memberCount: community.memberCount
      });
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
      io.emit('communities_stream', {
        communityId: community._id.toString(),
        memberCount: community.memberCount
      });
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
