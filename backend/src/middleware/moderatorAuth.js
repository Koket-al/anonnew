export function requireModeratorAuth(req, res, next) {
  const secret = process.env.MODERATOR_SECRET || 'dev_moderator_secret_passphrase';
  const provided = req.headers['x-moderator-secret'] || req.cookies?.anon_mod_secret;

  if (!provided || provided !== secret) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Valid moderator credentials required.'
    });
  }

  req.moderatorId = 'authorized_moderator';
  next();
}
