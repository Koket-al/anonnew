import xss from 'xss';
import { Post } from '../models/Post.js';
import { Reply } from '../models/Reply.js';
import { Community } from '../models/Community.js';
import { CommunityMembership } from '../models/CommunityMembership.js';

export async function listPosts(req, res, next) {
  try {
    const { communityId, category, sort = 'recent', filter = 'all', page = 1, limit = 20 } = req.query;

    const query = { isDeleted: false };

    if (communityId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(communityId);
      const targetCommunity = await Community.findOne(isObjectId ? { _id: communityId } : { slug: communityId });
      if (!targetCommunity) {
        return res.status(404).json({ success: false, error: 'Community not found.' });
      }

      const currentUserId = req.identity?._id?.toString();
      const isCreator = currentUserId && targetCommunity.creator?.toString() === currentUserId;
      let isMember = Boolean(isCreator);

      if (!isMember && req.identity) {
        const membership = await CommunityMembership.findOne({
          community: targetCommunity._id,
          identity: req.identity._id
        });
        if (membership) {
          isMember = true;
        }
      }

      if (!isMember) {
        return res.status(403).json({
          success: false,
          error: `You must join c/${targetCommunity.name} to view its questions and discussions.`,
          requiresMembership: true,
          community: {
            id: targetCommunity._id,
            name: targetCommunity.name,
            slug: targetCommunity.slug
          }
        });
      }

      query.community = targetCommunity._id;
    } else if (req.query.scope === 'public') {
      // Only general crowd posts (not attached to a specific community)
      query.community = null;
    } else {
      // If not scoped and no specific community, only return public posts or posts from communities user has joined
      if (req.identity) {
        const userMemberships = await CommunityMembership.find({ identity: req.identity._id }).select('community');
        const userCommunityIds = userMemberships.map(m => m.community);
        query.$or = [
          { community: null },
          { community: { $in: userCommunityIds } }
        ];
      } else {
        query.community = null;
      }
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (filter === 'been_through_this') {
      query.hasBeenThroughThis = true;
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'active') {
      sortOptions = { lastActivityAt: -1 };
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(take)
        .populate('author', 'username avatarSeed status')
        .populate('community', 'name slug topic creator'),
      Post.countDocuments(query)
    ]);

    const currentUserId = req.identity?._id?.toString();

    const formatted = posts.map(p => {
      const isCommunityOwner = Boolean(
        currentUserId &&
        p.community &&
        p.community.creator &&
        p.community.creator.toString() === currentUserId
      );
      const isAuthorActive = Boolean(p.author && p.author.status === 'active');
      const isAuthorRemoved = !p.author;
      const isOwnPost = Boolean(currentUserId && p.author?._id?.toString() === currentUserId);
      const canConnect = !isOwnPost && isAuthorActive && Boolean(p.author?._id);

      return {
        id: p._id,
        title: p.title,
        content: p.content,
        author: p.author ? {
          username: p.author.username,
          avatarSeed: p.author.avatarSeed,
          isRemoved: false,
          isInactive: p.author.status !== 'active'
        } : {
          username: 'Anonymous',
          avatarSeed: 'default',
          isRemoved: true,
          isInactive: false
        },
        authorId: p.author?._id || null,
        canConnect,
        isOwnPost,
        isCommunityOwner,
        canDelete: isOwnPost || isCommunityOwner,
        community: p.community ? {
          id: p.community._id,
          name: p.community.name,
          slug: p.community.slug,
          topic: p.community.topic,
          creator: p.community.creator
        } : null,
        category: p.category,
        hasBeenThroughThis: p.hasBeenThroughThis,
        beenThroughThisCount: p.beenThroughThisCount,
        hasMarkedBeenThroughThis: currentUserId && p.beenThroughThisUsers?.some(u => u.toString() === currentUserId),
        replyCount: p.replyCount,
        isEdited: Boolean(p.isEdited),
        editedAt: p.editedAt || null,
        createdAt: p.createdAt,
        lastActivityAt: p.lastActivityAt
      };
    });

    res.json({
      success: true,
      posts: formatted,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / take)
    });
  } catch (error) {
    next(error);
  }
}

export async function createPost(req, res, next) {
  try {
    const { title, content, communityId, category, hasBeenThroughThis } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Title must be at least 3 characters.' });
    }

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Question content must be at least 10 characters.' });
    }

    let community = null;
    if (communityId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(communityId);
      community = await Community.findOne(isObjectId ? { _id: communityId } : { slug: communityId });
      if (!community) {
        return res.status(404).json({ success: false, error: 'Specified community not found.' });
      }

      // Verify membership: only joined members or creator can post
      const isCreator = community.creator?.toString() === req.identity._id.toString();
      let isMember = Boolean(isCreator);
      if (!isMember) {
        const membership = await CommunityMembership.findOne({
          community: community._id,
          identity: req.identity._id
        });
        if (membership) isMember = true;
      }

      if (!isMember) {
        return res.status(403).json({
          success: false,
          error: `You must join c/${community.name} before asking or posting in this community.`,
          requiresMembership: true,
          community: {
            id: community._id,
            name: community.name,
            slug: community.slug
          }
        });
      }
    }

    const post = await Post.create({
      title: xss(title.trim()),
      content: xss(content.trim()),
      author: req.identity._id,
      community: community ? community._id : null,
      category: xss(category?.trim() || (community ? community.topic : 'General Discussion')),
      hasBeenThroughThis: Boolean(hasBeenThroughThis),
      lastActivityAt: new Date()
    });

    if (community) {
      community.postCount += 1;
      await community.save();
    }

    const formattedPost = {
      id: post._id,
      title: post.title,
      content: post.content,
      author: {
        username: req.identity.username,
        avatarSeed: req.identity.avatarSeed,
        isRemoved: false,
        isInactive: false
      },
      authorId: req.identity._id,
      community: community ? {
        id: community._id,
        name: community.name,
        slug: community.slug,
        topic: community.topic,
        creator: community.creator
      } : null,
      category: post.category,
      hasBeenThroughThis: post.hasBeenThroughThis,
      beenThroughThisCount: 0,
      replyCount: 0,
      createdAt: post.createdAt,
      lastActivityAt: post.lastActivityAt
    };

    const io = req.app.get('io');
    if (io) {
      if (!community) {
        // Broadcast standalone public discussion posts to global stream (Ask the Crowd)
        io.to('posts_stream').emit('new_post', formattedPost);
      } else {
        // Community-specific posts are broadcast ONLY to the community room
        io.to(`community:${community._id}`).emit('new_post', formattedPost);

        // Notify active members of this community
        CommunityMembership.find({ community: community._id })
          .select('identity')
          .then((members) => {
            members.forEach((m) => {
              if (m.identity.toString() !== req.identity._id.toString()) {
                io.to(`user:${m.identity}`).emit('community_post_notification', {
                  communityId: community._id.toString(),
                  communityName: community.name,
                  communitySlug: community.slug,
                  postId: post._id.toString(),
                  postTitle: post.title,
                  authorUsername: req.identity.username,
                  createdAt: post.createdAt
                });
              }
            });
          })
          .catch(() => {});
      }
    }

    res.status(201).json({
      success: true,
      post: formattedPost
    });
  } catch (error) {
    next(error);
  }
}

export async function getPost(req, res, next) {
  try {
    const { id } = req.params;
    const post = await Post.findById(id)
      .populate('author', 'username avatarSeed status')
      .populate('community', 'name slug topic creator');

    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, error: 'Post not found or has been removed.' });
    }

    const replies = await Reply.find({ post: post._id, isDeleted: false })
      .sort({ createdAt: 1 })
      .populate('author', 'username avatarSeed status');

    const currentUserId = req.identity?._id?.toString();
    const isCommunityOwner = Boolean(
      currentUserId &&
      post.community &&
      post.community.creator &&
      post.community.creator.toString() === currentUserId
    );
    const isOwnPost = Boolean(currentUserId && post.author?._id?.toString() === currentUserId);
    const isAuthorActive = Boolean(post.author && post.author.status === 'active');
    const canConnectPost = !isOwnPost && isAuthorActive && Boolean(post.author?._id);

    let isCommunityMember = false;
    if (post.community) {
      if (isCommunityOwner) {
        isCommunityMember = true;
      } else if (req.identity) {
        const membership = await CommunityMembership.findOne({
          community: post.community._id,
          identity: req.identity._id
        });
        if (membership) isCommunityMember = true;
      }

      if (!isCommunityMember) {
        return res.status(403).json({
          success: false,
          error: `You must join c/${post.community.name} to view this discussion.`,
          requiresMembership: true,
          community: {
            id: post.community._id,
            name: post.community.name,
            slug: post.community.slug,
            topic: post.community.topic
          }
        });
      }
    }

    res.json({
      success: true,
      post: {
        id: post._id,
        title: post.title,
        content: post.content,
        author: post.author ? {
          username: post.author.username,
          avatarSeed: post.author.avatarSeed,
          isRemoved: false,
          isInactive: post.author.status !== 'active'
        } : {
          username: 'Anonymous',
          avatarSeed: 'default',
          isRemoved: true,
          isInactive: false
        },
        authorId: post.author?._id || null,
        canConnect: canConnectPost,
        isOwnPost,
        isCommunityOwner,
        canDelete: isOwnPost || isCommunityOwner,
        community: post.community ? {
          id: post.community._id,
          name: post.community.name,
          slug: post.community.slug,
          topic: post.community.topic,
          creator: post.community.creator,
          isMember: isCommunityMember
        } : null,
        category: post.category,
        hasBeenThroughThis: post.hasBeenThroughThis,
        beenThroughThisCount: post.beenThroughThisCount,
        hasMarkedBeenThroughThis: currentUserId && post.beenThroughThisUsers?.some(u => u.toString() === currentUserId),
        replyCount: post.replyCount,
        isEdited: Boolean(post.isEdited),
        editedAt: post.editedAt || null,
        createdAt: post.createdAt,
        lastActivityAt: post.lastActivityAt
      },
      replies: replies.map(r => {
        const isOwnReply = Boolean(currentUserId && r.author?._id?.toString() === currentUserId);
        const isReplyAuthorActive = Boolean(r.author && r.author.status === 'active');
        const canConnectReply = !isOwnReply && isReplyAuthorActive && Boolean(r.author?._id);

        return {
          id: r._id,
          content: r.content,
          author: r.author ? {
            username: r.author.username,
            avatarSeed: r.author.avatarSeed,
            isRemoved: false,
            isInactive: r.author.status !== 'active'
          } : {
            username: 'Anonymous',
            avatarSeed: 'default',
            isRemoved: true,
            isInactive: false
          },
          authorId: r.author?._id || null,
          canConnect: canConnectReply,
          isOwnReply,
          isCommunityOwner,
          canDelete: isOwnReply || isCommunityOwner,
          isExperienceShare: r.isExperienceShare,
          isEdited: Boolean(r.isEdited),
          editedAt: r.editedAt || null,
          createdAt: r.createdAt
        };
      })
    });
  } catch (error) {
    next(error);
  }
}

export async function createReply(req, res, next) {
  try {
    const { id } = req.params;
    const { content, isExperienceShare } = req.body;

    if (!content || content.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Reply text must be at least 2 characters.' });
    }

    const post = await Post.findById(id).populate('community', 'name slug creator');
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, error: 'Post not found or has been removed.' });
    }

    if (post.community) {
      const isCommunityOwner = Boolean(
        req.identity &&
        post.community.creator &&
        post.community.creator.toString() === req.identity._id.toString()
      );
      let isCommunityMember = isCommunityOwner;
      if (!isCommunityMember) {
        const membership = await CommunityMembership.findOne({
          community: post.community._id,
          identity: req.identity._id
        });
        if (membership) isCommunityMember = true;
      }

      if (!isCommunityMember) {
        return res.status(403).json({
          success: false,
          error: `You must join c/${post.community.name} before replying or commenting.`,
          requiresMembership: true,
          community: {
            id: post.community._id,
            name: post.community.name,
            slug: post.community.slug
          }
        });
      }
    }

    const reply = await Reply.create({
      post: post._id,
      author: req.identity._id,
      content: xss(content.trim()),
      isExperienceShare: Boolean(isExperienceShare)
    });

    post.replyCount += 1;
    post.lastActivityAt = new Date();
    await post.save();

    const replyPayload = {
      id: reply._id,
      postId: post._id,
      content: reply.content,
      author: {
        username: req.identity.username,
        avatarSeed: req.identity.avatarSeed
      },
      authorId: req.identity._id,
      isExperienceShare: reply.isExperienceShare,
      createdAt: reply.createdAt
    };

    const io = req.app.get('io');
    if (io) {
      // Broadcast reply to anyone currently viewing the post
      io.to(`post:${post._id}`).emit('new_reply', replyPayload);

      // Update post preview across active streams
      const updatePayload = {
        postId: post._id.toString(),
        replyCount: post.replyCount,
        lastActivityAt: post.lastActivityAt
      };
      if (!post.community) {
        io.to('posts_stream').emit('post_updated', updatePayload);
      } else {
        const commId = post.community._id || post.community;
        io.to(`community:${commId}`).emit('post_updated', updatePayload);
      }

      // Notify the post's author if someone else replied to their question
      if (post.author && post.author.toString() !== req.identity._id.toString()) {
        io.to(`user:${post.author}`).emit('post_reply_notification', {
          postId: post._id.toString(),
          postTitle: post.title,
          replyId: reply._id.toString(),
          replierUsername: req.identity.username,
          replyContent: reply.content.slice(0, 120),
          createdAt: reply.createdAt
        });
      }
    }

    res.status(201).json({
      success: true,
      reply: {
        ...replyPayload,
        isOwnReply: true
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleBeenThroughThis(req, res, next) {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('community', 'name slug creator');

    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }

    if (post.community) {
      const isCommunityOwner = Boolean(
        req.identity &&
        post.community.creator &&
        post.community.creator.toString() === req.identity._id.toString()
      );
      let isCommunityMember = isCommunityOwner;
      if (!isCommunityMember) {
        const membership = await CommunityMembership.findOne({
          community: post.community._id,
          identity: req.identity._id
        });
        if (membership) isCommunityMember = true;
      }

      if (!isCommunityMember) {
        return res.status(403).json({
          success: false,
          error: `You must join c/${post.community.name} to participate.`,
          requiresMembership: true,
          community: {
            id: post.community._id,
            name: post.community.name,
            slug: post.community.slug
          }
        });
      }
    }

    const userId = req.identity._id;
    const alreadyMarked = post.beenThroughThisUsers.some(u => u.toString() === userId.toString());

    if (alreadyMarked) {
      post.beenThroughThisUsers = post.beenThroughThisUsers.filter(u => u.toString() !== userId.toString());
      post.beenThroughThisCount = Math.max(0, post.beenThroughThisCount - 1);
    } else {
      post.beenThroughThisUsers.push(userId);
      post.beenThroughThisCount += 1;
    }

    await post.save();

    const io = req.app.get('io');
    if (io) {
      const reactionPayload = {
        postId: post._id.toString(),
        beenThroughThisCount: post.beenThroughThisCount,
        hasMarkedBeenThroughThis: !alreadyMarked
      };
      io.to(`post:${post._id}`).emit('post_reaction_updated', reactionPayload);
      if (!post.community) {
        io.to('posts_stream').emit('post_reaction_updated', reactionPayload);
      } else {
        const commId = post.community._id || post.community;
        io.to(`community:${commId}`).emit('post_reaction_updated', reactionPayload);
      }
    }

    res.json({
      success: true,
      hasMarkedBeenThroughThis: !alreadyMarked,
      beenThroughThisCount: post.beenThroughThisCount
    });
  } catch (error) {
    next(error);
  }
}

export async function deletePost(req, res, next) {
  try {
    const { id } = req.params;
    const currentId = req.identity._id;

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, error: 'Question not found.' });
    }

    let isCommunityOwner = false;
    if (post.community) {
      const comm = await Community.findById(post.community);
      if (comm && comm.creator.toString() === currentId.toString()) {
        isCommunityOwner = true;
      }
    }

    if (post.author.toString() !== currentId.toString() && !isCommunityOwner) {
      return res.status(403).json({ success: false, error: 'You are not authorized to delete this question.' });
    }

    post.isDeleted = true;
    post.deletedReason = isCommunityOwner && post.author.toString() !== currentId.toString()
      ? 'Removed by community owner'
      : 'Consciously deleted by author';
    await post.save();

    // Also mark its replies as deleted
    await Reply.updateMany({ post: post._id }, { $set: { isDeleted: true } });

    // Decrement community post count if attached
    if (post.community) {
      await Community.findByIdAndUpdate(post.community, { $inc: { postCount: -1 } });
    }

    const io = req.app.get('io');
    if (io) {
      const delPayload = { postId: post._id.toString() };
      io.to(`post:${post._id}`).emit('post_deleted', delPayload);
      if (!post.community) {
        io.to('posts_stream').emit('post_deleted', delPayload);
      } else {
        io.to(`community:${post.community}`).emit('post_deleted', delPayload);
      }
    }

    res.json({
      success: true,
      postId: post._id,
      message: 'Question and associated replies deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteReply(req, res, next) {
  try {
    const replyId = req.params.replyId || req.params.id;
    const currentId = req.identity._id;

    const reply = await Reply.findById(replyId);
    if (!reply || reply.isDeleted) {
      return res.status(404).json({ success: false, error: 'Reply not found.' });
    }

    let isCommunityOwner = false;
    const parentPost = await Post.findById(reply.post);
    if (parentPost && parentPost.community) {
      const comm = await Community.findById(parentPost.community);
      if (comm && comm.creator.toString() === currentId.toString()) {
        isCommunityOwner = true;
      }
    }

    if (reply.author.toString() !== currentId.toString() && !isCommunityOwner) {
      return res.status(403).json({ success: false, error: 'You are not authorized to delete this reply.' });
    }

    reply.isDeleted = true;
    reply.deletedReason = isCommunityOwner && reply.author.toString() !== currentId.toString()
      ? 'Removed by community owner'
      : 'Consciously deleted by author';
    await reply.save();

    await Post.findByIdAndUpdate(reply.post, { $inc: { replyCount: -1 } });

    const io = req.app.get('io');
    if (io) {
      const delReplyPayload = {
        postId: reply.post.toString(),
        replyId: reply._id.toString(),
        replyCount: Math.max(0, (parentPost?.replyCount || 1) - 1)
      };
      io.to(`post:${reply.post}`).emit('reply_deleted', delReplyPayload);
      if (!parentPost?.community) {
        io.to('posts_stream').emit('post_updated', {
          postId: reply.post.toString(),
          replyCount: delReplyPayload.replyCount
        });
      } else {
        io.to(`community:${parentPost.community}`).emit('post_updated', {
          postId: reply.post.toString(),
          replyCount: delReplyPayload.replyCount
        });
      }
    }

    res.json({
      success: true,
      replyId: reply._id,
      message: 'Reply deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const currentUserId = req.identity._id.toString();

    const post = await Post.findById(id).populate('community', 'creator');
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, error: 'Post not found or has been removed.' });
    }

    if (post.author.toString() !== currentUserId) {
      return res.status(403).json({ success: false, error: 'You can only edit your own post.' });
    }

    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, error: 'Title cannot be empty.' });
      }
      post.title = xss(title.trim().slice(0, 200));
    }

    if (content !== undefined) {
      if (!content || !content.trim()) {
        return res.status(400).json({ success: false, error: 'Content cannot be empty.' });
      }
      post.content = xss(content.trim().slice(0, 5000));
    }

    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    const io = req.app.get('io');
    if (io) {
      const updatePayload = {
        postId: post._id.toString(),
        title: post.title,
        content: post.content,
        isEdited: true,
        editedAt: post.editedAt
      };
      io.to(`post:${post._id}`).emit('post_edited', updatePayload);
      if (post.community) {
        io.to(`community:${post.community._id || post.community}`).emit('post_edited', updatePayload);
      } else {
        io.to('posts_stream').emit('post_edited', updatePayload);
      }
    }

    res.json({
      success: true,
      post: {
        id: post._id,
        title: post.title,
        content: post.content,
        isEdited: post.isEdited,
        editedAt: post.editedAt
      },
      message: 'Post updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function updateReply(req, res, next) {
  try {
    const replyId = req.params.replyId || req.params.id;
    const { content } = req.body;
    const currentUserId = req.identity._id.toString();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Reply content cannot be empty.' });
    }

    const reply = await Reply.findById(replyId).populate('post');
    if (!reply || reply.isDeleted) {
      return res.status(404).json({ success: false, error: 'Reply not found or has been removed.' });
    }

    if (reply.author.toString() !== currentUserId) {
      return res.status(403).json({ success: false, error: 'You can only edit your own reply.' });
    }

    const sanitizedContent = xss(content.trim().slice(0, 2500));
    reply.content = sanitizedContent;
    reply.isEdited = true;
    reply.editedAt = new Date();
    await reply.save();

    const io = req.app.get('io');
    if (io) {
      const replyPayload = {
        replyId: reply._id.toString(),
        postId: reply.post._id.toString(),
        content: reply.content,
        isEdited: true,
        editedAt: reply.editedAt
      };
      io.to(`post:${reply.post._id}`).emit('reply_edited', replyPayload);
    }

    res.json({
      success: true,
      reply: {
        id: reply._id,
        content: reply.content,
        isEdited: reply.isEdited,
        editedAt: reply.editedAt
      },
      message: 'Reply updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}
