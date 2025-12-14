require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/env');
const sheetsRoutes = require('./routes/sheets');
const healthRoutes = require('./routes/health');
const errorHandler = require('./middleware/errorHandler');
const rateLimitMiddleware = require('./middleware/rateLimit');

const app = express();

// Middleware
app.use(morgan(config.logLevel === 'debug' ? 'dev' : 'combined'));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Global Rate Limiting (Applied to all routes for safety, can be tuned per route)
// app.use(rateLimitMiddleware); // Currently applied inside routes or here? Plan said middleware.
// We'll apply it globally for now or specific routes? Plan said "Implement Rate Limiting".
// Let's implement the middleware file first, then use it.

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/sheets', sheetsRoutes);

// Error Handler
app.use(errorHandler);

// Start Server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 CDM Proxy running on port ${PORT} in ${config.env} mode`);
    console.log(`🔗 Connected to AppScript: ${config.appScriptUrl ? 'configured' : 'MISSING URL'}`);
});
