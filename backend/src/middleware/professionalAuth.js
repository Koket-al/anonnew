import jwt from 'jsonwebtoken';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';

export async function requireProfessionalAuth(req, res, next) {
  try {
    let token = req.cookies?.anon_pro_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Professional authorization required.'
      });
    }

    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_replace_in_production_32bytes_min';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired professional token.'
      });
    }

    const professional = await ProfessionalAccount.findById(decoded.id).select('-passwordHash');
    if (!professional) {
      return res.status(401).json({
        success: false,
        error: 'Professional account not found.'
      });
    }

    if (professional.verificationStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your professional account has been suspended.'
      });
    }

    req.professional = professional;
    next();
  } catch (error) {
    next(error);
  }
}
