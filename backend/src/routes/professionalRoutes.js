import express from 'express';
import {
  registerProfessional,
  loginProfessional,
  getProfessionalProfile,
  updateProfessionalProfile,
  listVerifiedProfessionals,
  submitConsultationRequest,
  getConsultationsForProfessional,
  respondToConsultation,
  getMyAnonymousConsultations
} from '../controllers/professionalController.js';
import { requireProfessionalAuth } from '../middleware/professionalAuth.js';
import { requireAnonymousAuth } from '../middleware/auth.js';
import { postRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public / directory
router.get('/', listVerifiedProfessionals);
router.get('/directory', listVerifiedProfessionals);

// Professional account actions
router.post('/register', postRateLimiter, registerProfessional);
router.post('/login', postRateLimiter, loginProfessional);
router.get('/me', requireProfessionalAuth, getProfessionalProfile);
router.patch('/me', requireProfessionalAuth, updateProfessionalProfile);
router.get('/consultations', requireProfessionalAuth, getConsultationsForProfessional);
router.post('/consultations/:id/respond', requireProfessionalAuth, respondToConsultation);

// Anonymous user consultation actions
router.post('/consultations', requireAnonymousAuth, postRateLimiter, submitConsultationRequest);
router.get('/my-consultations', requireAnonymousAuth, getMyAnonymousConsultations);

export default router;
