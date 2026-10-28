import express from 'express';
import {
  adminLogin,
  getAdminMe,
  getAdminPendingProfessionals,
  getAdminAllProfessionals,
  reviewProfessionalApplication,
  createDirectProfessional,
  deleteProfessional
} from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Admin login
router.post('/login', postRateLimiter, adminLogin);

// Protected admin routes
router.use(requireAdminAuth);

router.get('/me', getAdminMe);
router.get('/professionals/pending', getAdminPendingProfessionals);
router.get('/professionals', getAdminAllProfessionals);
router.post('/professionals/:id/review', reviewProfessionalApplication);
router.post('/professionals', postRateLimiter, createDirectProfessional);
router.delete('/professionals/:id', deleteProfessional);

export default router;
