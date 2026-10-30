import express from 'express';
import {
  listPosts,
  createPost,
  getPost,
  createReply,
  toggleBeenThroughThis,
  updatePost,
  deletePost,
  updateReply,
  deleteReply
} from '../controllers/postController.js';
import { requireAnonymousAuth, optionalAnonymousAuth } from '../middleware/auth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', optionalAnonymousAuth, listPosts);
router.post('/', requireAnonymousAuth, postRateLimiter, createPost);
router.get('/:id', optionalAnonymousAuth, getPost);
router.patch('/:id', requireAnonymousAuth, postRateLimiter, updatePost);
router.put('/:id', requireAnonymousAuth, postRateLimiter, updatePost);
router.delete('/:id', requireAnonymousAuth, deletePost);
router.post('/:id/replies', requireAnonymousAuth, postRateLimiter, createReply);
router.patch('/replies/:replyId', requireAnonymousAuth, postRateLimiter, updateReply);
router.patch('/:id/replies/:replyId', requireAnonymousAuth, postRateLimiter, updateReply);
router.put('/replies/:replyId', requireAnonymousAuth, postRateLimiter, updateReply);
router.put('/:id/replies/:replyId', requireAnonymousAuth, postRateLimiter, updateReply);
router.delete('/replies/:replyId', requireAnonymousAuth, deleteReply);
router.delete('/:id/replies/:replyId', requireAnonymousAuth, deleteReply);
router.post('/:id/been-through-this', requireAnonymousAuth, toggleBeenThroughThis);

export default router;
