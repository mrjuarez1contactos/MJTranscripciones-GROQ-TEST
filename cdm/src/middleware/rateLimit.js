const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../config/redis');
const config = require('../config/env');

// Define rate limits
// Note: rate-limiter-flexible handles atomic increments in Redis

const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'middleware_rl',
    points: config.rateLimit.minute, // Requests per duration
    duration: 60, // Per 60 seconds
});

const rateLimitMiddleware = async (req, res, next) => {
    try {
        // Limit by User ID if authenticated, else IP
        const key = req.user ? req.user.user_id : req.ip;

        await rateLimiter.consume(key);
        next();
    } catch (rejRes) {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            retry_after: Math.round(rejRes.msBeforeNext / 1000) || 60
        });
    }
};

module.exports = rateLimitMiddleware;
