const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

class OpenSubtitlesClient {
    constructor() {
        this.baseUrl = 'https://api.opensubtitles.com/api/v1';
        this.userAgent = config.openSubtitles.userAgent;
    }

    configure(apiKey) {
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Api-Key': apiKey,
                'User-Agent': this.userAgent,
                'Content-Type': 'application/json'
            }
        });
    }

    async searchSubtitles(params) {
        try {
            if (!this.client) {
                throw new Error('OpenSubtitles client not configured. Call configure() first.');
            }

            const response = await this.client.get('/subtitles', { params });
            return response.data.data;
        } catch (error) {
            logger.error('OpenSubtitles search error:', error.message);
            return [];
        }
    }

    async downloadSubtitle(fileId) {
        try {
            if (!this.client) {
                throw new Error('OpenSubtitles client not configured. Call configure() first.');
            }

            const response = await this.client.post('/download', { file_id: fileId });
            return response.data.link;
        } catch (error) {
            logger.error('OpenSubtitles download error:', error.message);
            return null;
        }
    }

    async getSubtitles(type, imdbId, season = null, episode = null) {
        const params = {
            imdb_id: imdbId.replace('tt', ''),
            type: type === 'series' ? 'episode' : 'movie'
        };

        if (type === 'series') {
            params.season_number = season;
            params.episode_number = episode;
        }

        return await this.searchSubtitles(params);
    }
}

module.exports = new OpenSubtitlesClient(); 