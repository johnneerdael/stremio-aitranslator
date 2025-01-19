const RedisService = require('./redis');
const debug = require('debug')('stremio:config');

// Default configuration
const DEFAULT_CONFIG = {
    cacheTime: Number(process.env.CACHE_TIME) || 24,
    maxConcurrent: Number(process.env.MAX_CONCURRENT) || 3,
    debugMode: process.env.DEBUG_MODE === 'true' || false,
    translateTo: 'dut'
};

class ConfigService {
    static instance;
    redis = null;

    static async getInstance() {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
            await ConfigService.instance.init();
        }
        return ConfigService.instance;
    }

    async init() {
        this.redis = await RedisService.getInstance();

        // Set default config values if not exists
        const config = await this.getAll();
        for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
            if (!(key in config)) {
                await this.set(key, value);
            }
        }
    }

    async getAll() {
        const config = {...DEFAULT_CONFIG};
        const redisConfig = await this.redis.getAllConfig();
        
        return {...config, ...redisConfig};
    }

    async get(key) {
        const value = await this.redis.getConfig(key);
        return value ?? DEFAULT_CONFIG[key];
    }

    async set(key, value) {
        await this.redis.setConfig(key, value);
        if (await this.isDebugMode()) {
            debug(`Config updated: ${key} = ${JSON.stringify(value)}`);
        }
    }

    async isDebugMode() {
        return this.get('debugMode');
    }
}

module.exports = ConfigService;
