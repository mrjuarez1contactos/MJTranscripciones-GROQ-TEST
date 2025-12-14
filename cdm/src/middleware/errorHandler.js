const errorHandler = (err, req, res, next) => {
    console.error('❌ Global Error:', err.message);
    if (err.stack) console.error(err.stack);

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        success: false,
        error: message,
        code: err.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
};

module.exports = errorHandler;
