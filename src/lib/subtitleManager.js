const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class SubtitleManager {
    constructor() {
        this.baseDir = 'subtitles';
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
            await fs.writeFile(filePath, content, 'utf8');
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
}

module.exports = new SubtitleManager(); 