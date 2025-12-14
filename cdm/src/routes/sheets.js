const express = require('express');
const router = express.Router();
const appScriptService = require('../services/appScript');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rateLimit');

// Apply security middleware to all sheets routes
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// GET /api/v1/sheets/read
router.get('/read', async (req, res, next) => {
    try {
        const userId = req.user.user_id; // From JWT
        const result = await appScriptService.readTranscriptions(userId);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/sheets/getText?id=...
router.get('/getText', async (req, res, next) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Missing file id' });
        }

        // Basic validation for ID format? (Alphanumeric + - _)
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return res.status(400).json({ success: false, error: 'Invalid file id format' });
        }

        const result = await appScriptService.getText(id);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/sheets/update
router.post('/update', async (req, res, next) => {
    try {
        const { id, resumen } = req.body;

        if (!id || !resumen) {
            return res.status(400).json({ success: false, error: 'Missing id or resumen' });
        }

        const result = await appScriptService.update(id, resumen);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
