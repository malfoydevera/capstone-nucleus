function sendSuccess(res, {
  status = 200,
  message,
  data = {},
  meta,
}) {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...data,
    ...(meta ? { meta } : {}),
  });
}

function sendError(res, {
  status = 500,
  code = 'SERVER_ERROR',
  message = 'Server error',
  details,
  requestId,
}) {
  const resolvedRequestId = requestId || res.locals?.requestId || res.getHeader?.('x-request-id');
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
    message,
    ...(resolvedRequestId ? { requestId: resolvedRequestId } : {}),
    ...(details ? { details } : {}),
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
