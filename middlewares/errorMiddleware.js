const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Validation errors
  if (err.name === 'ValidationError' || err.name === 'ValidatorError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors
    });
  }

  // Custom errors from validators
  if (err.message && err.message.includes('Invalid') || 
      err.message && err.message.includes('required')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Default server error
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server'
  });
};

module.exports = errorHandler;