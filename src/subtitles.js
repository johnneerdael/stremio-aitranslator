const fs = require('fs').promises;

/**
 * Creates or updates a placeholder subtitle file with a status message
 */
async function createOrUpdateMessageSub(placeholderText, imdbId, season = null, episode = null, targetLanguage) {
    try {
        const subtitleFilePath = generateSubtitlePath(imdbId, season, episode, targetLanguage, true);
        
        const placeholderSub = [
            "1",
            "00:00:01,000 --> 00:10:50,000",
            placeholderText,
            ""
        ].join('\n');

        const dir = subtitleFilePath.substring(0, subtitleFilePath.lastIndexOf('/'));
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(subtitleFilePath, placeholderSub);
    } catch (error) {
        console.error("Error creating/updating placeholder subtitle:", error);
        throw error;
    }
}

/**
 * Updates the translation progress in the subtitle file
 */
async function updateTranslationProgress(imdbId, season, episode, targetLanguage, progress, processedCount, totalCount) {
    try {
        const subtitleFilePath = generateSubtitlePath(imdbId, season, episode, targetLanguage, true);
        
        const progressSub = [
            "1",
            "00:00:01,000 --> 00:10:50,000",
            `Translating subtitles... ${progress}% complete`,
            `(${processedCount}/${totalCount} subtitles translated)`,
            "Please wait or refresh to check progress.",
            ""
        ].join('\n');

        await fs.writeFile(subtitleFilePath, progressSub);
    } catch (error) {
        console.error("Error updating translation progress:", error);
    }
}

/**
 * Formats a subtitle block for writing to file
 */
function formatSubtitle(subtitle) {
    return `${subtitle.index}\n${subtitle.timing}\n${subtitle.text}\n\n`;
}

/**
 * Parses SRT content into structured format
 */
function parseSRT(srtContent) {
    const subtitleBlocks = srtContent.split('\r\n\r\n').filter(Boolean);
    
    return subtitleBlocks.map(block => {
        const lines = block.split(/\r?\n/).filter(Boolean);
        return {
            index: lines[0],
            timing: lines[1],
            text: lines.slice(2).join('\n')
        };
    });
}

/**
 * Ensures the subtitle directory exists
 */
async function ensureSubtitleDirectory(imdbId, season = null, targetLanguage) {
    const dirPath = generateSubtitlePath(imdbId, season, null, targetLanguage, false)
        .split('/')
        .slice(0, -1)
        .join('/');
    
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
}

/**
 * Generates the path for a subtitle file
 */
function generateSubtitlePath(imdbId, season = null, episode = null, targetLanguage, isPlaceholder = false) {
    const baseDir = season && episode
        ? `subtitles/${targetLanguage}/${imdbId}/season${season}`
        : `subtitles/${targetLanguage}/${imdbId}`;
    
    const suffix = isPlaceholder ? '-placeholder' : '';
    const fileName = season && episode
        ? `${imdbId}-translated-${episode}-1${suffix}.srt`
        : `${imdbId}-translated-1${suffix}.srt`;
    
    return `${baseDir}/${fileName}`;
}

module.exports = {
    createOrUpdateMessageSub,
    updateTranslationProgress,
    formatSubtitle,
    parseSRT,
    ensureSubtitleDirectory,
    generateSubtitlePath
}; 