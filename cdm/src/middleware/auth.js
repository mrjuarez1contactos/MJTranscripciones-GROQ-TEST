const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token missing' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded; // Attach user payload to request
        next();
    } catch (err) {
        console.error("JWT Verification Failed:", err.message);
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
