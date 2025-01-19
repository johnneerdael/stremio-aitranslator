const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const debug = require('debug')('stremio:database');
const path = require('path');

class DatabaseService {
    static instance;
    db = null;

    static async getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
            await DatabaseService.instance.init();
        }
        return DatabaseService.instance;
    }

    async init() {
        const dbPath = path.join(__dirname, '../../data/stremio.db');
        
        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await this.createTables();
        debug('Database initialized');
    }

    async createTables() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS translations (
                id TEXT PRIMARY KEY,
                source_language TEXT,
                target_language TEXT,
                original_text TEXT,
                translated_text TEXT,
                video_id TEXT,
                timestamp INTEGER,
                status TEXT,
                created_at INTEGER,
                updated_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_languages 
            ON translations(source_language, target_language);

            CREATE INDEX IF NOT EXISTS idx_video 
            ON translations(video_id);

            CREATE INDEX IF NOT EXISTS idx_status 
            ON translations(status);

            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
        debug('Database tables created');
    }

    // Translation methods
    async getTranslation(key) {
        const result = await this.db.get(
            'SELECT * FROM translations WHERE id = ?',
            [key]
        );
        return result;
    }

    async setTranslation(key, data) {
        const now = Date.now();
        await this.db.run(`
            INSERT OR REPLACE INTO translations (
                id, source_language, target_language, 
                original_text, translated_text, video_id,
                timestamp, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            key,
            data.sourceLang,
            data.targetLang,
            data.originalText,
            data.translatedText,
            data.videoId || null,
            now,
            'completed',
            data.created_at || now,
            now
        ]);
    }

    // Config methods
    async getConfig(key) {
        const row = await this.db.get(
            'SELECT value FROM config WHERE key = ?',
            [key]
        );
        if (!row) return null;
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }

    async setConfig(key, value) {
        const stringValue = typeof value === 'object' ? 
            JSON.stringify(value) : String(value);
            
        await this.db.run(
            'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
            [key, stringValue]
        );
    }

    async getAllConfig() {
        const rows = await this.db.all('SELECT key, value FROM config');
        const config = {};
        
        rows.forEach(row => {
            try {
                config[row.key] = JSON.parse(row.value);
            } catch {
                config[row.key] = row.value;
            }
        });
        
        return config;
    }

    // Statistics methods
    async getStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT source_language || '-' || target_language) as language_pairs,
                COUNT(DISTINCT video_id) as videos,
                AVG(updated_at - created_at) as avg_translation_time
            FROM translations
        `);
        return stats;
    }

    async cleanup(maxAge) {
        const cutoff = Date.now() - maxAge;
        await this.db.run(
            'DELETE FROM translations WHERE timestamp < ?',
            [cutoff]
        );
    }
}

module.exports = DatabaseService;
