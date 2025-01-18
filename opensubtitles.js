const axios = require('axios');
const fs = require('fs').promises;

const OPENSUBTITLES_BASE_URL = 'https://opensubtitles-v3.strem.io/subtitles/';

/**
 * Downloads subtitle files from URLs
 * @param {string[]} subtitleUrls - Array of subtitle URLs to download
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string[]>} Array of downloaded file paths
 */
async function downloadSubtitles(subtitleUrls, imdbId, season = null, episode = null, targetLanguage) {
    try {
        // Create directory structure
        const baseDir = season && episode
            ? `subtitles/original/${targetLanguage}/${imdbId}/season${season}`
            : `subtitles/original/${targetLanguage}/${imdbId}`;
        
        await fs.mkdir(baseDir, { recursive: true });

        const filePaths = [];
        for (let i = 0; i < subtitleUrls.length; i++) {
            const url = subtitleUrls[i];
            try {
                // Download subtitle
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                
                // Generate file path
                const filePath = season && episode
                    ? `${baseDir}/${imdbId}-subtitle-${episode}-${i + 1}.srt`
                    : `${baseDir}/${imdbId}-subtitle-${i + 1}.srt`;

                // Save file
                await fs.writeFile(filePath, response.data);
                console.log(`Subtitle downloaded and saved: ${filePath}`);
                filePaths.push(filePath);
            } catch (error) {
                console.error(`Error downloading subtitle from ${url}:`, error.message);
                throw error;
            }
        }
        return filePaths;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

/**
 * Fetches available subtitles from OpenSubtitles
 * @param {string} type - Content type ('series' or 'movie')
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string[]|null>} Array of subtitle URLs or null if none found
 */
async function getSubtitles(type, imdbId, season = null, episode = null, targetLanguage) {
    try {
        // Construct API URL
        let url = OPENSUBTITLES_BASE_URL;
        if (type === 'series') {
            url = `${url}${type}/${imdbId}:${season}:${episode}.json`;
        } else {
            url = `${url}${type}/${imdbId}.json`;
        }

        // Fetch subtitles metadata
        const response = await axios.get(url);
        const subtitles = response.data.subtitles;

        if (subtitles.length > 0) {
            // Check if target language already exists
            if (subtitles.some(subtitle => subtitle.lang === targetLanguage)) {
                console.log(`Subtitles already exist in ${targetLanguage}`);
                return null;
            }

            // Get English subtitles (or fallback to first available)
            let selectedSubs = subtitles
                .filter(subtitle => subtitle.lang === 'eng')
                .map(subtitle => subtitle.url);

            if (selectedSubs.length === 0) {
                console.log('No English subtitles found, using first available');
                selectedSubs = [subtitles[0].url];
            }

            // Return only the first subtitle URL
            return selectedSubs.slice(0, 1);
        }

        console.log('No subtitles found');
        return null;
    } catch (error) {
        console.error('Error fetching subtitles:', error);
        throw error;
    }
}

module.exports = {
    getSubtitles,
    downloadSubtitles
}; 