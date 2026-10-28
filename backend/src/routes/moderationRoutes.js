import express from 'express';
import {
  submitReport,
  listReports,
  resolveReport,
  deleteContentModeration,
  suspendIdentityModeration,
  listPendingProfessionals,
  reviewProfessionalVerification
} from '../controllers/moderationController.js';
import { requireAnonymousAuth } from '../middleware/auth.js';
import { requireModeratorAuth } from '../middleware/moderatorAuth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Reporting is open to authenticated anonymous users
router.post('/report', requireAnonymousAuth, postRateLimiter, submitReport);

// Protected moderator operations
router.use(requireModeratorAuth);

router.get('/reports', listReports);
router.post('/reports/:id/resolve', resolveReport);
router.post('/content/remove', deleteContentModeration);
router.post('/identity/suspend', suspendIdentityModeration);
router.get('/professionals/pending', listPendingProfessionals);
router.post('/professionals/:id/verify', reviewProfessionalVerification);

export default router;
