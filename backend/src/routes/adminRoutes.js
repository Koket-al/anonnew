import express from 'express';
import {
  adminLogin,
  adminLogout,
  getAdminMe,
  getAdminPendingProfessionals,
  getAdminAllProfessionals,
  reviewProfessionalApplication,
  createDirectProfessional,
  deleteProfessional,
  setModeratorRole
} from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Admin login / logout (public)
router.post('/login', postRateLimiter, adminLogin);
router.post('/logout', adminLogout);

// Protected admin routes
router.use(requireAdminAuth);

router.get('/me', getAdminMe);
router.get('/professionals/pending', getAdminPendingProfessionals);
router.get('/professionals', getAdminAllProfessionals);
router.post('/professionals/:id/review', reviewProfessionalApplication);
router.post('/professionals', postRateLimiter, createDirectProfessional);
router.delete('/professionals/:id', deleteProfessional);

// Grant / revoke moderator role for an anonymous identity (admin-only)
router.post('/identities/:id/moderator', setModeratorRole);

export default router;
