const axios = require('axios');
const redisClient = require('../config/redis');
const config = require('../config/env');

class AppScriptService {
    constructor() {
        // Construct the URL if script ID is present, fallback to full URL
        if (config.sheetScriptId) {
            this.baseUrl = `https://script.google.com/macros/s/${config.sheetScriptId}/exec`;
        } else {
            this.baseUrl = config.appScriptUrl;
        }
        this.timeout = config.appScriptTimeout;
    }

    async call(params, method = 'GET', body = null) {
        if (!this.baseUrl) throw new Error("APPSCRIPT_URL or SHEET_SCRIPT_ID is not configured");

        try {
            const response = await axios({
                method: method,
                url: this.baseUrl,
                // If using 'exec' URL, query params control routing in doGet
                // But for POST, we often put action in body.
                // Our GAS handles 'action' in query OR body.
                // We'll put generic params in URL to be safe for redirects.
                params: params,
                data: body,
                timeoue: this.timeout,
                headers: { 'Content-Type': 'application/json' },
                maxRedirects: 5,
                // GAS often redirects (302) to googleusercontent. 
                // Axios follows redirects by default for GET.
                // For POST, GAS requires following redirects with POST method (Lax)
                // Axios might switch to GET on 302 unless we specify validation.
                // Actually GAS for 'exec' usually works fine if we permit redirects.
            });

            if (response.data && response.data.status === 'error') {
                throw new Error(`GAS Error: ${response.data.message}`);
            }

            return response.data;
        } catch (error) {
            console.error("AppScript Call Error:", error.message);
            if (error.response) {
                // If 404 or similar
                throw new Error(`AppScript request failed: ${error.response.status}`);
            }
            throw error;
        }
    }

    // --- CACHING HELPERS ---
    async getCachedOrFetch(key, ttl, fetchFn) {
        try {
            const cached = await redisClient.get(key);
            if (cached) {
                return { ...JSON.parse(cached), cached: true };
            }
        } catch (e) {
            console.warn("Redis Get Error:", e.message);
        }

        const data = await fetchFn();

        try {
            if (ttl > 0 && data) {
                await redisClient.set(key, JSON.stringify(data), { EX: ttl });
            }
        } catch (e) {
            console.warn("Redis Set Error:", e.message);
        }

        return { ...data, cached: false };
    }

    // --- PUBLIC METHODS ---

    async readTranscriptions(userId) {
        const cacheKey = `transcriptions:list:${userId || 'global'}`;
        return this.getCachedOrFetch(cacheKey, config.cacheTtl.read, () =>
            this.call({ action: 'read' })
        );
    }

    async getText(fileId) {
        const cacheKey = `transcription:content:${fileId}`;
        return this.getCachedOrFetch(cacheKey, config.cacheTtl.getText, () =>
            this.call({ action: 'getText', id: fileId })
        );
    }

    async update(id, summary) {
        const result = await this.call(
            { action: 'update' }, // query param to route in GAS
            'POST',
            { id: id, resumen: summary }
        );

        // Invalidate cache
        try {
            await redisClient.del(`transcription:content:${id}`);
            // TODO: Smart invalidation of lists
        } catch (e) {
            console.warn("Cache Invalidation Error:", e.message);
        }
        return result;
    }

    async createTranscription(data) {
        // action='transcripcion' or 'create'
        return this.call(
            { action: 'create' },
            'POST',
            data // expect { id, file_name, status, ... }
        );
    }

    async logEvent(data) {
        return this.call(
            { action: 'log' },
            'POST',
            data
        );
    }

    async getConfig() {
        return this.call({ action: 'config' });
    }
}

module.exports = new AppScriptService();
