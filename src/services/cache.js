const ConfigService = require('./config');
const debug = require('debug')('stremio:cache');

class CacheService {
    static instance;
    cache = new Map();
    config = null;

    static async getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
            await CacheService.instance.init();
        }
        return CacheService.instance;
    }

    async init() {
        this.config = await ConfigService.getInstance();
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const cacheTime = await this.config.get('cacheTime');
        const expiryTime = item.timestamp + (cacheTime * 60 * 60 * 1000);

        if (Date.now() > expiryTime) {
            this.cache.delete(key);
            return null;
        }

        if (await this.config.isDebugMode()) {
            debug(`Cache hit: ${key}`);
        }

        return item.value;
    }

    async set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });

        if (await this.config.isDebugMode()) {
            debug(`Cache set: ${key}`);
        }
    }
}

module.exports = CacheService; 