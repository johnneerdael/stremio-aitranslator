const axios = require('axios');
const logger = require('./logger');

class OpenSubtitlesClient {
    constructor() {
        this.baseUrl = 'https://api.opensubtitles.com/api/v1';
        this.client = null;
    }

    configure(apiKey, appName) {
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': apiKey,
                'User-Agent': appName
            }
        });
    }

    async getSubtitles(type, imdbId, season = null, episode = null) {
        try {
            if (!this.client) {
                throw new Error('OpenSubtitles not configured. Call configure() first.');
            }

            const query = {
                imdb_id: imdbId.replace('tt', ''),
                type: type === 'series' ? 'episode' : 'movie'
            };

            if (type === 'series') {
                query.season_number = season;
                query.episode_number = episode;
            }

            const response = await this.client.get('/subtitles', { params: query });
            return response.data.data;
        } catch (error) {
            logger.error('Error fetching subtitles:', error.message);
            return [];
        }
    }

    async downloadSubtitle(fileId) {
        try {
            if (!this.client) {
                throw new Error('OpenSubtitles not configured. Call configure() first.');
            }

            const response = await this.client.post('/download', { file_id: fileId });
            return response.data.link;
        } catch (error) {
            logger.error('Error downloading subtitle:', error.message);
            return null;
        }
    }
}

module.exports = new OpenSubtitlesClient();
