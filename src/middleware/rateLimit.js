import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
    windowMs: 5000,
    max: 1,
    keyGenerator: (req, res) => {
        return req.currentUserId ? req.currentUserId : req.ip;
    },
    message: {
        success: false,
        message: 'Çox sürətli sorğu göndərilir',
        data: null
    }
});

export default apiLimiter;