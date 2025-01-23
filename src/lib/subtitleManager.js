const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class SubtitleManager {
    constructor() {
        this.baseDir = 'subtitles';
        this.inProgressTranslations = new Map();
    }

    async ensureDirectoryExists(type, language, imdbId, season = null) {
        let dirPath;
        if (type === 'series' && season !== null) {
            dirPath = path.join(this.baseDir, language, imdbId, `season${season}`);
        } else {
            dirPath = path.join(this.baseDir, language, imdbId);
        }
        
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return dirPath;
        } catch (error) {
            logger.error(`Error creating directory: ${error.message}`);
            throw error;
        }
    }

    getSubtitlePath(type, language, imdbId, count, season = null, episode = null) {
        let filename;
        if (type === 'series') {
            filename = `${imdbId}-translated-${episode}-${count}.srt`;
            return path.join(this.baseDir, language, imdbId, `season${season}`, filename);
        } else {
            filename = `${imdbId}-translated-${count}.srt`;
            return path.join(this.baseDir, language, imdbId, filename);
        }
    }

    async saveSubtitle(type, language, imdbId, content, count, season = null, episode = null) {
        try {
            await this.ensureDirectoryExists(type, language, imdbId, season);
            const filePath = this.getSubtitlePath(type, language, imdbId, count, season, episode);
            
            // Save content with UTF-8 encoding and BOM for compatibility
            const contentWithBOM = '\ufeff' + content;
            await fs.writeFile(filePath, contentWithBOM, 'utf8');
            
            logger.info(`Subtitle saved: ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error(`Error saving subtitle: ${error.message}`);
            throw error;
        }
    }

    async getSubtitleCount(type, language, imdbId, season = null) {
        try {
            const dirPath = await this.ensureDirectoryExists(type, language, imdbId, season);
            const files = await fs.readdir(dirPath);
            return files.filter(f => f.endsWith('.srt')).length;
        } catch (error) {
            logger.error(`Error getting subtitle count: ${error.message}`);
            return 0;
        }
    }

    async findTranslation(type, language, imdbId, season = null, episode = null) {
        try {
            const dirPath = await this.ensureDirectoryExists(type, language, imdbId, season);
            const files = await fs.readdir(dirPath);
            
            // Find any existing translation
            const pattern = type === 'series' 
                ? `${imdbId}-translated-${episode}-` 
                : `${imdbId}-translated-`;
            
            const existingFile = files.find(f => f.startsWith(pattern) && f.endsWith('.srt'));
            if (existingFile) {
                return path.join(dirPath, existingFile);
            }

            return null;
        } catch (error) {
            logger.error(`Error finding translation: ${error.message}`);
            return null;
        }
    }

    isTranslationInProgress(type, language, imdbId, season = null, episode = null) {
        const key = `${type}_${language}_${imdbId}_${season}_${episode}`;
        return this.inProgressTranslations.has(key);
    }

    setTranslationInProgress(type, language, imdbId, season = null, episode = null, inProgress = true) {
        const key = `${type}_${language}_${imdbId}_${season}_${episode}`;
        if (inProgress) {
            this.inProgressTranslations.set(key, Date.now());
        } else {
            this.inProgressTranslations.delete(key);
        }
    }

    cleanupStaleTranslations(maxAgeMs = 5 * 60 * 1000) { // 5 minutes default
        const now = Date.now();
        for (const [key, startTime] of this.inProgressTranslations.entries()) {
            if (now - startTime > maxAgeMs) {
                this.inProgressTranslations.delete(key);
                logger.warn(`Cleaned up stale translation: ${key}`);
            }
        }
    }
}

module.exports = new SubtitleManager();
