import jwt from 'jsonwebtoken';

/**
 * Returns the JWT secret from environment.
 * Throws if not configured, preventing any insecure fallback.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[SECURITY] JWT_SECRET environment variable is missing or too short (must be ≥32 chars).');
  }
  return secret;
}

/**
 * Middleware to protect Admin endpoints.
 * Requires a valid JWT token with role='admin' issued to the configured admin email.
 * Algorithm is explicitly restricted to HS256 — the 'none' algorithm attack is prevented.
 */
export function requireAdminAuth(req, res, next) {
  try {
    let token = null;

    // Prefer httpOnly cookie; fall back to Authorization header or custom header
    if (req.cookies && req.cookies.anon_admin_token) {
      token = req.cookies.anon_admin_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Admin authorization required.'
      });
    }

    let secret;
    try {
      secret = getJwtSecret();
    } catch {
      return res.status(500).json({ success: false, error: 'Server authentication configuration error.' });
    }

    // algorithms: ['HS256'] prevents algorithm confusion attacks (e.g., 'none' or RS256 downgrade)
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

    const configuredEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

    if (
      decoded.role !== 'admin' ||
      !decoded.email ||
      decoded.email.toLowerCase().trim() !== configuredEmail
    ) {
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
