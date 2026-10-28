import express from 'express';
import {
  listCommunities,
  createCommunity,
  getCommunity,
  getCommunityMembers,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  removeCommunityPost
} from '../controllers/communityController.js';
import { requireAnonymousAuth, optionalAnonymousAuth } from '../middleware/auth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', optionalAnonymousAuth, listCommunities);
router.post('/', requireAnonymousAuth, postRateLimiter, createCommunity);
router.get('/:identifier/members', requireAnonymousAuth, getCommunityMembers);
router.get('/:identifier', optionalAnonymousAuth, getCommunity);
router.patch('/:id', requireAnonymousAuth, updateCommunity);
router.post('/:id/join', requireAnonymousAuth, joinCommunity);
router.post('/:id/leave', requireAnonymousAuth, leaveCommunity);
router.delete('/:communityId/posts/:postId', requireAnonymousAuth, removeCommunityPost);

export default router;
