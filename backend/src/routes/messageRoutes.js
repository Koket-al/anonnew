import express from 'express';
import {
  requestConversation,
  respondToRequest,
  listConversations,
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  blockUser,
  closeConversation
} from '../controllers/messageController.js';
import { requireAnonymousAuth } from '../middleware/auth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(requireAnonymousAuth);

router.get('/', listConversations);
router.post('/request', postRateLimiter, requestConversation);
router.post('/:id/respond', respondToRequest);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', postRateLimiter, sendMessage);
router.patch('/message/:messageId', postRateLimiter, updateMessage);
router.patch('/:id/messages/:messageId', postRateLimiter, updateMessage);
router.put('/message/:messageId', postRateLimiter, updateMessage);
router.put('/:id/messages/:messageId', postRateLimiter, updateMessage);
router.delete('/message/:messageId', deleteMessage);
router.delete('/:id/messages/:messageId', deleteMessage);
router.post('/block', blockUser);
router.post('/:id/close', closeConversation);

export default router;
