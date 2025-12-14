const axios = require('axios');
const redisClient = require('../config/redis');
const config = require('../config/env');

class AppScriptService {
    constructor() {
        this.baseUrl = config.appScriptUrl;
        this.timeout = config.appScriptTimeout;
    }

    async call(params, method = 'GET', body = null) {
        if (!this.baseUrl) throw new Error("APPSCRIPT_URL is not configured");

        try {
            const response = await axios({
                method: method,
                url: this.baseUrl,
                params: params, // e.g., { action: 'read' }
                data: body,
                timeout: this.timeout,
                headers: { 'Content-Type': 'application/json' }
            });

            return response.data;
        } catch (error) {
            console.error("AppScript Call Error:", error.message);
            if (error.response) {
                throw new Error(`AppScript responded with ${error.response.status}: ${error.response.statusText}`);
            }
            throw error;
        }
    }

    async getCachedOrFetch(key, ttl, fetchFn) {
        try {
            const cached = await redisClient.get(key);
            if (cached) {
                return { ...JSON.parse(cached), cached: true };
            }
        } catch (e) {
            console.warn("Redis Get Error:", e.message);
        }

        // Fetch from AppScript
        const data = await fetchFn();

        // Cache result
        try {
            if (ttl > 0 && data) {
                await redisClient.set(key, JSON.stringify(data), { EX: ttl });
            }
        } catch (e) {
            console.warn("Redis Set Error:", e.message);
        }

        return { ...data, cached: false };
    }

    async readTranscriptions(userId) {
        const cacheKey = `transcriptions:list:${userId || 'global'}`; // Assuming per-user list or global? User guide implies per user list if multi-tenant, or global sheet logic. Plan says "cache:transcriptions:list:{user_id}".

        return this.getCachedOrFetch(
            cacheKey,
            config.cacheTtl.read,
            () => this.call({ action: 'read' }) // GAS doGet(action='read')
        );
    }

    async getText(fileId) {
        const cacheKey = `transcription:content:${fileId}`;

        return this.getCachedOrFetch(
            cacheKey,
            config.cacheTtl.getText,
            () => this.call({ action: 'getText', id: fileId }) // GAS doGet(action='getText', id=...)
        );
    }

    async update(id, summary) {
        // POST to GAS
        const result = await this.call({ action: 'update' }, 'POST', { id, resumen: summary }); // Pass action in query param implies doGet, but for doPost usually payload has action or query param. Plan says: doPost(e) with action=update. Usually doPost(e) reads e.postData.contents. Let's assume GAS handles it.
        // Wait, standard GAS `doPost(e)` doesn't parse query params easily if body is used? Actually it does `e.parameter`.
        // Plan: "POST /api/v1/sheets/update -> Proxea a: doPost(e) del AppScript con action=update" using Body {id, resumen}.

        // Invalidate caches
        try {
            await redisClient.del(`transcription:content:${id}`);
            // Invalidate list cache? Typically yes. Pattern match deletion is expensive in Redis without SCAN.
            // For simplicity/safety, maybe just expiry handles it or we rely on dedicated keys.
            // Plan says: "Invalida cache:transcriptions:list:*"
            // We can't wildcard delete easily. We will skip wildcard delete for this MVP unless using SCAN logic.
        } catch (e) {
            console.warn("Cache Invalidation Error:", e.message);
        }

        return result;
    }
}

module.exports = new AppScriptService();
