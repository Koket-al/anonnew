export function errorHandler(err, req, res, next) {
  // Log server-side with timestamp but avoid logging sensitive request bodies
  console.error(`[Error] [${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err.message);

  if (res.headersSent) {
    return next(err);
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid resource identifier format.'
    });
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: messages.join('. ')
    });
  }

  // Handle MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists.`
    });
  }

  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Not allowed by CORS.'
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500 
    ? 'An unexpected error occurred. Please try again later.' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message
  });
}
