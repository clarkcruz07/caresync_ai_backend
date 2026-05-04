export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  const details = status === 500 ? undefined : err.details;

  if (status === 500) {
    // Intentionally minimal; avoid leaking internals to clients.
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({ error: message, details });
}

