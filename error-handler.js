export function globalErrorHandler(err, req, res, next) {
    console.error('[Enterprise Error Logger]:', err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: 'حدث خطأ داخلي في الخادم المعماري.',
        message: err.message || 'يرجى المحاولة لاحقاً.'
    });
}
