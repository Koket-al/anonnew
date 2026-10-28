import express from 'express';
import {
  requestConversation,
  respondToRequest,
  listConversations,
  getMessages,
  sendMessage,
  blockUser,
  closeConversation,
  deleteMessage
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
router.delete('/message/:messageId', deleteMessage);
router.delete('/:id/messages/:messageId', deleteMessage);
router.post('/block', blockUser);
router.post('/:id/close', closeConversation);

export default router;
