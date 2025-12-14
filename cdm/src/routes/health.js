const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis'); // We'll create this next

router.get('/', async (req, res) => {
    let redisStatus = 'unknown';
    try {
        if (redisClient.isOpen) {
            await redisClient.ping();
            redisStatus = 'connected';
        } else {
            redisStatus = 'disconnected';
        }
    } catch (e) {
        redisStatus = 'error';
    }

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            redis: redisStatus,
            cdm: 'running'
        }
    });
});

module.exports = router;
