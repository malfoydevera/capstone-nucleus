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
}) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
