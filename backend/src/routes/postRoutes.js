import express from 'express';
import {
  listPosts,
  createPost,
  getPost,
  createReply,
  toggleBeenThroughThis,
  deletePost,
  deleteReply
} from '../controllers/postController.js';
import { requireAnonymousAuth, optionalAnonymousAuth } from '../middleware/auth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', optionalAnonymousAuth, listPosts);
router.post('/', requireAnonymousAuth, postRateLimiter, createPost);
router.get('/:id', optionalAnonymousAuth, getPost);
router.delete('/:id', requireAnonymousAuth, deletePost);
router.post('/:id/replies', requireAnonymousAuth, postRateLimiter, createReply);
router.delete('/replies/:replyId', requireAnonymousAuth, deleteReply);
router.delete('/:id/replies/:replyId', requireAnonymousAuth, deleteReply);
router.post('/:id/been-through-this', requireAnonymousAuth, toggleBeenThroughThis);

export default router;
