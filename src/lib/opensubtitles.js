const axios = require('axios');
const logger = require('./logger');

class OpenSubtitlesAPI {
    constructor() {
        this.baseUrl = 'https://api.opensubtitles.com/api/v1';
        this.apiKey = null;
        this.appName = null;
    }

    configure(apiKey, appName) {
        this.apiKey = apiKey;
        this.appName = appName;
    }

    async searchSubtitles(imdbId, type, season = null, episode = null) {
        try {
            const params = {
                imdb_id: imdbId.replace('tt', ''),
                languages: 'eng', // Always fetch English subtitles as source
            };

            if (type === 'series' && season !== null && episode !== null) {
                params.season_number = season;
                params.episode_number = episode;
            }

            const response = await axios.get(`${this.baseUrl}/subtitles`, {
                params,
                headers: {
                    'Api-Key': this.apiKey,
                    'User-Agent': this.appName,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.data || !response.data.data) {
                logger.warn(`No subtitles found for ${imdbId}`);
                return null;
            }

            // Sort by download count and ratings to get best quality subs
            const subtitles = response.data.data
                .filter(sub => sub.attributes.language === 'en')
                .sort((a, b) => {
                    const scoreA = (a.attributes.download_count || 0) * (a.attributes.ratings || 0);
                    const scoreB = (b.attributes.download_count || 0) * (b.attributes.ratings || 0);
                    return scoreB - scoreA;
                });

            if (!subtitles.length) {
                logger.warn(`No English subtitles found for ${imdbId}`);
                return null;
            }

            // Return the best subtitle
            return subtitles[0];

        } catch (error) {
            logger.error(`OpenSubtitles API error: ${error.message}`);
            return null;
        }
    }

    async downloadSubtitle(fileId) {
        try {
            // Get download link
            const response = await axios.post(`${this.baseUrl}/download`, 
                { file_id: fileId },
                {
                    headers: {
                        'Api-Key': this.apiKey,
                        'User-Agent': this.appName,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data || !response.data.link) {
                throw new Error('No download link received');
            }

            // Download actual subtitle content
            const download = await axios.get(response.data.link);
            return download.data;

        } catch (error) {
            logger.error(`Subtitle download error: ${error.message}`);
            return null;
        }
    }
}

module.exports = new OpenSubtitlesAPI();
