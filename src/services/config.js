const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
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
    db = null;

    static async getInstance() {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
            await ConfigService.instance.init();
        }
        return ConfigService.instance;
    }

    async init() {
        this.db = await open({
            filename: 'data/config.db',
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
    }

    async getAll() {
        const config = {...DEFAULT_CONFIG};
        const rows = await this.db.all('SELECT key, value FROM config');
        
        rows.forEach(row => {
            try {
                config[row.key] = JSON.parse(row.value);
            } catch {
                config[row.key] = row.value;
            }
        });
        
        return config;
    }

    async get(key) {
        const row = await this.db.get('SELECT value FROM config WHERE key = ?', key);
        if (!row) return DEFAULT_CONFIG[key];
        
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }

    async set(key, value) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await this.db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', key, stringValue);
        if (this.isDebugMode()) {
            debug(`Config updated: ${key} = ${stringValue}`);
        }
    }

    async isDebugMode() {
        return this.get('debugMode');
    }
}

module.exports = ConfigService; 