import express from 'express';
import {
  listListeningRooms,
  createListeningRoom,
  getListeningRoom,
  joinListeningRoom,
  leaveListeningRoom,
  closeListeningRoom
} from '../controllers/listeningRoomController.js';
import { requireAnonymousAuth, optionalAnonymousAuth } from '../middleware/auth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', optionalAnonymousAuth, listListeningRooms);
router.post('/', requireAnonymousAuth, postRateLimiter, createListeningRoom);
router.get('/:id', optionalAnonymousAuth, getListeningRoom);
router.post('/:id/join', requireAnonymousAuth, joinListeningRoom);
router.post('/:id/leave', requireAnonymousAuth, leaveListeningRoom);
router.post('/:id/close', requireAnonymousAuth, closeListeningRoom);

export default router;
