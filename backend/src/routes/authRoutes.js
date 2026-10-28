import express from 'express';
import {
  enterAnonymously,
  getCurrentIdentity,
  createAdditionalIdentity,
  switchActiveIdentity,
  removeIdentity,
  newIdentity,
  leaveSession
} from '../controllers/authController.js';
import { requireAnonymousAuth, optionalAnonymousAuth } from '../middleware/auth.js';
import { sessionRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/enter', sessionRateLimiter, enterAnonymously);
router.get('/me', optionalAnonymousAuth, getCurrentIdentity);
router.post('/identities', optionalAnonymousAuth, sessionRateLimiter, createAdditionalIdentity);
router.post('/create-identity', optionalAnonymousAuth, sessionRateLimiter, createAdditionalIdentity);
router.post('/switch-identity', requireAnonymousAuth, sessionRateLimiter, switchActiveIdentity);
router.delete('/identities/:id', requireAnonymousAuth, sessionRateLimiter, removeIdentity);
router.post('/rotate', requireAnonymousAuth, sessionRateLimiter, newIdentity);
router.post('/leave', requireAnonymousAuth, leaveSession);

export default router;
