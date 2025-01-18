const ConfigService = require('./config');
const DatabaseService = require('./database');
const debug = require('debug')('stremio:cache');

class CacheService {
    static instance;
    config = null;
    db = null;

    static async getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
            await CacheService.instance.init();
        }
        return CacheService.instance;
    }

    async init() {
        this.config = await ConfigService.getInstance();
        this.db = await DatabaseService.getInstance();
        
        // Start cleanup job
        setInterval(async () => {
            const cacheTime = await this.config.get('cacheTime');
            await this.db.cleanup(cacheTime * 60 * 60 * 1000);
        }, 60 * 60 * 1000); // Run every hour
    }

    async get(key) {
        const item = await this.db.getTranslation(key);
        if (!item) return null;

        const cacheTime = await this.config.get('cacheTime');
        const expiryTime = item.timestamp + (cacheTime * 60 * 60 * 1000);

        if (Date.now() > expiryTime) {
            return null;
        }

        if (await this.config.isDebugMode()) {
            debug(`Cache hit: ${key}`);
        }

        return {
            sourceLang: item.source_language,
            targetLang: item.target_language,
            originalText: item.original_text,
            translatedText: item.translated_text,
            videoId: item.video_id
        };
    }

    async set(key, value) {
        await this.db.setTranslation(key, value);

        if (await this.config.isDebugMode()) {
            debug(`Cache set: ${key}`);
        }
    }

    async getStats() {
        return await this.db.getStats();
    }
}

module.exports = CacheService;
