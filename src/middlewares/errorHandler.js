class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const errorHandler = (err, req, res, next) => {
  if (err.code === '23505') {
    return res.status(409).json({
      ok: false,
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'Ya existe un registro con ese valor único',
        details: [err.detail].filter(Boolean)
      }
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'FOREIGN_KEY_ERROR',
        message: 'El registro relacionado no existe',
        details: [err.detail].filter(Boolean)
      }
    });
  }

  if (err.code === '22P02') {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_SYNTAX',
        message: 'Formato de parámetro o identificador no válido',
        details: []
      }
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'Error interno del servidor' : err.message,
      details: err.details || []
    }
  });
};

module.exports = { AppError, errorHandler };