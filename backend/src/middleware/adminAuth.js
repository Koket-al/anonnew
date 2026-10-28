import jwt from 'jsonwebtoken';

/**
 * Middleware to protect Admin endpoints.
 * Requires a valid JWT token issued to the authorized admin email.
 */
export function requireAdminAuth(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'];
    } else if (req.cookies && req.cookies.anon_admin_token) {
      token = req.cookies.anon_admin_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Admin authorization required.'
      });
    }

    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_replace_in_production_32bytes_min';
    const decoded = jwt.verify(token, secret);

    const configuredEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

    if (decoded.role !== 'admin' || !decoded.email || decoded.email.toLowerCase().trim() !== configuredEmail) {
      return res.status(403).json({
        success: false,
        error: 'Access restricted to authorized platform administrator.'
      });
    }

    req.admin = { email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired admin session. Please log in again.'
    });
  }
}
