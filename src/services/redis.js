const Redis = require('ioredis');
const debug = require('debug')('stremio:redis');

class RedisService {
    static instance = null;
    
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        
        this.redis.on('connect', () => {
            debug('Connected to Redis');
        });
        
        this.redis.on('error', (err) => {
            debug('Redis error:', err);
        });
    }
    
    static async getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    
    // Configuration methods
    async getConfig(key) {
        const value = await this.redis.hget('config', key);
        return value ? JSON.parse(value) : null;
    }
    
    async setConfig(key, value) {
        await this.redis.hset('config', key, JSON.stringify(value));
    }
    
    async getAllConfig() {
        const config = await this.redis.hgetall('config');
        return Object.entries(config || {}).reduce((acc, [key, value]) => {
            acc[key] = JSON.parse(value);
            return acc;
        }, {});
    }
    
    // Cache methods
    async get(key) {
        const value = await this.redis.get(`cache:${key}`);
        return value ? JSON.parse(value) : null;
    }
    
    async set(key, value, ttlHours = 24) {
        await this.redis.set(
            `cache:${key}`,
            JSON.stringify(value),
            'EX',
            ttlHours * 60 * 60
        );
    }
    
    async del(key) {
        await this.redis.del(`cache:${key}`);
    }
    
    // Queue methods
    async addToQueue(key, value) {
        await this.redis.rpush(`queue:${key}`, JSON.stringify(value));
    }
    
    async getFromQueue(key) {
        const value = await this.redis.lpop(`queue:${key}`);
        return value ? JSON.parse(value) : null;
    }
    
    async getQueueLength(key) {
        return await this.redis.llen(`queue:${key}`);
    }
}

module.exports = RedisService;
