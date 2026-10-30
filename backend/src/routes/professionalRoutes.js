import express from 'express';
import {
  registerProfessional,
  loginProfessional,
  logoutProfessional,
  getProfessionalProfile,
  updateProfessionalProfile,
  listVerifiedProfessionals,
  submitConsultationRequest,
  getConsultationsForProfessional,
  respondToConsultation,
  addConsultationMessage,
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
router.post('/logout', logoutProfessional);
router.get('/me', requireProfessionalAuth, getProfessionalProfile);
router.patch('/me', requireProfessionalAuth, updateProfessionalProfile);
router.get('/consultations', requireProfessionalAuth, getConsultationsForProfessional);
router.post('/consultations/:id/respond', requireProfessionalAuth, respondToConsultation);

// Interactive consultation messaging (doctor or user)
router.post('/consultations/:id/messages', postRateLimiter, async (req, res, next) => {
  let token = req.cookies?.anon_pro_token || req.headers['x-pro-token'];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    return requireProfessionalAuth(req, res, () => addConsultationMessage(req, res, next));
  }
  return requireAnonymousAuth(req, res, () => addConsultationMessage(req, res, next));
});

// Anonymous user consultation actions
router.post('/consultations', requireAnonymousAuth, postRateLimiter, submitConsultationRequest);
router.get('/my-consultations', requireAnonymousAuth, getMyAnonymousConsultations);

export default router;
