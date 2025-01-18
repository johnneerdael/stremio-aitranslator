const fs = require('fs').promises;

/**
 * Creates or updates a placeholder subtitle file with a status message
 * @param {string} placeholderText - Status message to display
 * @param {string} imdbid - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 */
async function createOrUpdateMessageSub(placeholderText, imdbid, season = null, episode = null, targetLanguage) {
    try {
        // Define subtitle file path based on content type
        let subtitleFilePath = null;
        if (season && episode) {
            subtitleFilePath = `subtitles/${targetLanguage}/${imdbid}/season${season}/${imdbid}-translated-${episode}-1.srt`;
        } else {
            subtitleFilePath = `subtitles/${targetLanguage}/${imdbid}/${imdbid}-translated-1.srt`;
        }

        // Create basic placeholder subtitle structure
        const placeholderSub = [
            "1",
            "00:00:01,000 --> 00:10:50,000",
            placeholderText,
            ""
        ].join('\n');

        // Ensure directory exists
        const dir = subtitleFilePath.substring(0, subtitleFilePath.lastIndexOf('/'));
        await fs.mkdir(dir, { recursive: true });

        // Create or update file
        await fs.writeFile(subtitleFilePath, placeholderSub);
    } catch (error) {
        console.error("Error creating/updating placeholder subtitle:", error);
        throw error;
    }
}

/**
 * Formats a subtitle block for writing to file
 * @param {Object} subtitle - Subtitle object containing index, timing, and text
 * @returns {string} Formatted subtitle block
 */
function formatSubtitle(subtitle) {
    return `${subtitle.index}\n${subtitle.timing}\n${subtitle.text}\n\n`;
}

/**
 * Parses SRT content into structured format
 * @param {string} srtContent - Raw SRT file content
 * @returns {Array} Array of parsed subtitle objects
 */
function parseSRT(srtContent) {
    // Split by double newline to separate subtitle blocks
    const subtitleBlocks = srtContent.split('\r\n\r\n').filter(Boolean);
    
    return subtitleBlocks.map(block => {
        // Split block into lines
        const lines = block.split(/\r?\n/).filter(Boolean);
        
        // First line is the index
        const subtitleIndex = lines[0];
        
        // Second line is the timestamp
        const timing = lines[1];
        
        // Remaining lines are the text
        const textLines = lines.slice(2);
        
        return {
            index: subtitleIndex,
            timing: timing,
            text: textLines.join('\n')
        };
    });
}

/**
 * Ensures the subtitle directory exists
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string} targetLanguage - Target language code
 * @returns {string} Directory path
 */
async function ensureSubtitleDirectory(imdbId, season = null, targetLanguage) {
    const basePath = `subtitles/${targetLanguage}`;
    const dirPath = season 
        ? `${basePath}/${imdbId}/season${season}`
        : `${basePath}/${imdbId}`;
    
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
}

/**
 * Generates the URL for accessing the subtitle file
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 * @returns {string} Subtitle file URL
 */
function generateSubtitleUrl(imdbId, season = null, episode = null, targetLanguage) {
    if (season && episode) {
        return `subtitles/${targetLanguage}/${imdbId}/season${season}/${imdbId}-translated-${episode}-1.srt`;
    }
    return `subtitles/${targetLanguage}/${imdbId}/${imdbId}-translated-1.srt`;
}

module.exports = {
    createOrUpdateMessageSub,
    formatSubtitle,
    parseSRT,
    ensureSubtitleDirectory,
    generateSubtitleUrl
}; 