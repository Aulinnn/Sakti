// response.js
export function success(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data
  });
}

export function error(res, message, statusCode = 500, errorDetail = null) {
  return res.status(statusCode).json({
    status: 'error',
    message,
    error: errorDetail
  });
}
