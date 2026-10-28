import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

export const sessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 identity creations/rotations per window
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many identity requests from this network. Please wait a few minutes before trying again.'
  }
});

export const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // max 20 AI prompts per window
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI assistant rate limit reached. Please wait a moment before sending another question.'
  }
});

export const postRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15,
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Posting rate limit reached. Please pause for a moment to prevent spam.'
  }
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.'
  }
});
