export function success(res, data = null, message = "Success", status = 200) {
  let finalData = data;

  // Jika data adalah object paginate dari BE
  if (data && data.data && data.meta) {
    finalData = data.data;
    return res.status(status).json({
      success: true,
      message,
      data: finalData,
      meta: data.meta,
    });
  }

  return res.status(status).json({
    success: true,
    message,
    data: finalData,
  });
}

export function error(res, message = "Error", status = 500, details = null) {
  return res.status(status).json({
    success: false,
    message,
    details,
  });
}
