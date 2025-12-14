const { createClient } = require('redis');
const config = require('./env');

const client = createClient({
    url: config.redisUrl
});

client.on('error', (err) => console.error('❌ Redis Client Error', err));
client.on('connect', () => console.log('✅ Redis Client Connected'));

// Auto-connect
(async () => {
    try {
        await client.connect();
    } catch (e) {
        console.error("Failed to connect to Redis on startup:", e.message);
    }
})();

module.exports = client;
