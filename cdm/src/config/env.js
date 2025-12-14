const config = {
    env: process.env.CDM_ENV || 'development',
    port: process.env.CDM_PORT || 3000,
    logLevel: process.env.CDM_LOG_LEVEL || 'info',

    appScriptUrl: process.env.APPSCRIPT_URL,
    appScriptTimeout: parseInt(process.env.APPSCRIPT_TIMEOUT_MS) || 30000,

    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    cacheTtl: {
        read: parseInt(process.env.CACHE_TTL_READ_TRANSCRIPTIONS) || 300,
        getText: parseInt(process.env.CACHE_TTL_GET_TEXT) || 900,
        update: 0
    },

    rateLimit: {
        minute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 100,
        hour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR) || 1000,
        day: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_DAY) || 5000
    },

    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || '*'
};

module.exports = config;
