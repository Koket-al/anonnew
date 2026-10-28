import express from 'express';
import { getAIStatus, askAI } from '../controllers/aiController.js';
import { requireAnonymousAuth } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/status', getAIStatus);
router.post('/chat', requireAnonymousAuth, aiRateLimiter, askAI);

export default router;
