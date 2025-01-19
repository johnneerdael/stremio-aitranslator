const RedisService = require('./redis');

class DatabaseService {
  static instance = null;
  
  constructor(redis) {
    this.redis = redis;
  }
  
  static async getInstance() {
    if (!DatabaseService.instance) {
      const redis = await RedisService.getInstance();
      DatabaseService.instance = new DatabaseService(redis);
    }
    return DatabaseService.instance;
  }

  async getAllConfig() {
    return await this.redis.getAllConfig();
  }

  async setConfig(key, value) {
    await this.redis.setConfig(key, value);
  }

  async getConfig(key) {
    return await this.redis.getConfig(key);
  }
}

module.exports = DatabaseService;
