const fs = require('fs').promises;

/**
 * Creates or updates a placeholder subtitle file with a status message
 * @param {string} placeholderText - Status message to display
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 */
async function createOrUpdateMessageSub(placeholderText, imdbId, season = null, episode = null, targetLanguage) {
    try {
        const subtitleFilePath = generateSubtitlePath(imdbId, season, episode, targetLanguage, true);
        
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
 * Updates the translation progress in the subtitle file
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 * @param {number} progress - Progress percentage (0-100)
 * @param {number} processedCount - Number of subtitles processed
 * @param {number} totalCount - Total number of subtitles
 */
async function updateTranslationProgress(imdbId, season, episode, targetLanguage, progress, processedCount, totalCount) {
    try {
        const subtitleFilePath = generateSubtitlePath(imdbId, season, episode, targetLanguage, true);
        
        // Create progress message
        const progressSub = [
            "1",
            "00:00:01,000 --> 00:10:50,000",
            `Translating subtitles... ${progress}% complete`,
            `(${processedCount}/${totalCount} subtitles translated)`,
            "Please wait or refresh to check progress.",
            ""
        ].join('\n');

        // Update file
        await fs.writeFile(subtitleFilePath, progressSub);
    } catch (error) {
        console.error("Error updating translation progress:", error);
        // Don't throw error - non-critical operation
    }
}

/**
 * Adjusts subtitle timing for mid-show starts
 * @param {string} sourcePath - Path to the source subtitle file
 * @param {string} targetPath - Path to save the adjusted subtitle file
 * @param {number} startTimeSeconds - Start time offset in seconds
 */
async function adjustSubtitleTiming(sourcePath, targetPath, startTimeSeconds) {
    try {
        // Read source file
        const content = await fs.readFile(sourcePath, 'utf8');
        const subtitles = content.split('\n\n');

        // Convert start time to milliseconds
        const startTimeMs = startTimeSeconds * 1000;

        // Process each subtitle block
        const adjustedSubtitles = subtitles.map(block => {
            const lines = block.split('\n');
            if (lines.length < 2) return ''; // Skip invalid blocks

            // Find timing line
            const timingLineIndex = lines.findIndex(line => line.includes(' --> '));
            if (timingLineIndex === -1) return block; // No timing found, return as is

            // Parse and adjust timing
            const timingLine = lines[timingLineIndex];
            const [start, end] = timingLine.split(' --> ').map(timeStr => {
                const [h, m, s] = timeStr.split(':');
                const [sec, ms] = s.split(',');
                return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec)) * 1000 + parseInt(ms);
            });

            // Adjust timings
            const adjustedStart = Math.max(0, start - startTimeMs);
            const adjustedEnd = Math.max(0, end - startTimeMs);

            // Skip subtitles that would end before 0
            if (adjustedEnd <= 0) return '';

            // Format adjusted times
            lines[timingLineIndex] = formatTime(adjustedStart) + ' --> ' + formatTime(adjustedEnd);

            return lines.join('\n');
        }).filter(Boolean); // Remove empty blocks

        // Ensure target directory exists
        const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
        await fs.mkdir(targetDir, { recursive: true });

        // Write adjusted subtitles
        await fs.writeFile(targetPath, adjustedSubtitles.join('\n\n'));
    } catch (error) {
        console.error("Error adjusting subtitle timing:", error);
        throw error;
    }
}

/**
 * Formats milliseconds into SRT time format (HH:MM:SS,mmm)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

/**
 * Pads a number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} length - Desired length (default: 2)
 * @returns {string} Padded number
 */
function pad(num, length = 2) {
    return num.toString().padStart(length, '0');
}

/**
 * Generates the path for a subtitle file
 * @param {string} imdbId - IMDB ID of the media
 * @param {string|null} season - Season number (optional)
 * @param {string|null} episode - Episode number (optional)
 * @param {string} targetLanguage - Target language code
 * @param {boolean} isPlaceholder - Whether this is a placeholder file
 * @param {number} startTime - Start time offset in seconds (optional)
 * @returns {string} The subtitle file path
 */
function generateSubtitlePath(imdbId, season, episode, targetLanguage, isPlaceholder = false, startTime = null) {
    const baseDir = season && episode
        ? `subtitles/${targetLanguage}/${imdbId}/season${season}`
        : `subtitles/${targetLanguage}/${imdbId}`;
    
    const suffix = isPlaceholder ? '-placeholder' : 
                  startTime ? `-offset-${startTime}` : '';
    const fileName = season && episode
        ? `${imdbId}-translated-${episode}-1${suffix}.srt`
        : `${imdbId}-translated-1${suffix}.srt`;
    
    return `${baseDir}/${fileName}`;
}

module.exports = {
    createOrUpdateMessageSub,
    updateTranslationProgress,
    generateSubtitlePath,
    adjustSubtitleTiming
}; 