/**
 * 404 handler — JSON for API paths, plain text otherwise.
 */
export function notFound(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
    });
  }
  res.status(404).type('text/plain').send('404 Not Found');
}

/**
 * Central error handler. Always returns JSON so the API is predictable.
 * Must keep the 4-argument signature for Express to treat it as an
 * error-handling middleware.
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const code =
    status === 400 && err.type === 'entity.parse.failed'
      ? 'BAD_JSON'
      : status >= 500
        ? 'INTERNAL'
        : 'BAD_REQUEST';

  const message =
    err.type === 'entity.parse.failed'
      ? 'Request body is not valid JSON.'
      : status >= 500
        ? 'An unexpected error occurred.'
        : err.message || 'Request could not be processed.';

  res.status(status).json({ error: { code, message, ...(err.fields ? { fields: err.fields } : {}) } });
}