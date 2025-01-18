const fs = require('fs').promises;
const { translateText } = require('./translateProvider');
const { updateTranslationProgress, createOrUpdateMessageSub } = require('./subtitles');

/**
 * Estimates tokens for a subtitle batch
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {number} Estimated token count
 */
function estimateTokens(subtitles) {
    // Rough estimate: 1 token per 4 characters + overhead
    const totalChars = subtitles.reduce((sum, sub) => sum + sub.text.length, 0);
    return Math.ceil(totalChars / 4) + (subtitles.length * 10); // 10 tokens overhead per subtitle
}

/**
 * Gets the next batch of subtitles based on target token count
 * @param {Array} subtitles - Array of all subtitles
 * @param {number} startIndex - Starting index
 * @param {number} targetTokens - Target token count
 * @returns {Object} Batch info {batch: Array, nextIndex: number, tokenCount: number}
 */
function getNextBatch(subtitles, startIndex, targetTokens) {
    let currentTokens = 0;
    let batchSize = 0;
    const batch = [];

    while (startIndex + batchSize < subtitles.length && currentTokens < targetTokens) {
        const subtitle = subtitles[startIndex + batchSize];
        const subtitleTokens = estimateTokens([subtitle]);
        
        if (currentTokens + subtitleTokens > targetTokens * 1.1) { // Allow 10% overflow
            break;
        }

        batch.push(subtitle);
        currentTokens += subtitleTokens;
        batchSize++;
    }

    return {
        batch,
        nextIndex: startIndex + batchSize,
        tokenCount: currentTokens
    };
}

/**
 * Finds the subtitle index closest to a given timestamp
 * @param {Array} subtitles - Array of subtitle objects
 * @param {number} targetTime - Target timestamp in milliseconds
 * @returns {number} Index of the closest subtitle
 */
function findClosestSubtitleIndex(subtitles, targetTime) {
    let closestIndex = 0;
    let minDiff = Infinity;

    subtitles.forEach((sub, index) => {
        const startTime = parseTimeToMs(sub.startTime);
        const diff = Math.abs(startTime - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = index;
        }
    });

    return closestIndex;
}

/**
 * Converts SRT time format to milliseconds
 * @param {string} timeStr - Time string in HH:MM:SS,mmm format
 * @returns {number} Time in milliseconds
 */
function parseTimeToMs(timeStr) {
    const [h, m, s] = timeStr.split(':');
    const [sec, ms] = s.split(',');
    return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec)) * 1000 + parseInt(ms);
}

/**
 * Processes a batch of subtitles for translation
 * @param {Array} batch - Array of subtitle objects to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Array} Translated subtitle objects
 */
async function processBatch(batch, targetLanguage) {
    // Combine subtitle texts with timing info for context
    const texts = batch.map(sub => `[${sub.startTime} --> ${sub.endTime}]\n${sub.text}`);
    const combinedText = texts.join('\n\n');

    // Translate with context
    const translatedText = await translateText(combinedText, targetLanguage);

    // Split and parse translated text back into subtitles
    const translatedParts = translatedText.split('\n\n');
    
    return batch.map((sub, index) => ({
        ...sub,
        text: translatedParts[index].split('\n').slice(1).join('\n') // Remove timing line
    }));
}

/**
 * Processes subtitles with token-based batching and start time prioritization
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} options - Processing options
 * @returns {Array} Translated subtitles
 */
async function processSubtitles(subtitles, options) {
    const {
        imdbId,
        season,
        episode,
        targetLanguage,
        startTime = 0,
        targetTokens = 5000 // Default batch token target
    } = options;

    let processedSubtitles = new Array(subtitles.length).fill(null);
    let processedCount = 0;

    // If starting mid-show, find the closest subtitle
    const startTimeMs = startTime * 1000;
    const startIndex = startTime > 0 ? findClosestSubtitleIndex(subtitles, startTimeMs) : 0;

    // Create processing ranges for prioritized translation
    const ranges = [];
    if (startTime > 0) {
        // First range: Around start time (30 subtitles before and after)
        const beforeStart = Math.max(0, startIndex - 30);
        const afterStart = Math.min(subtitles.length, startIndex + 30);
        ranges.push({ start: beforeStart, end: afterStart, priority: 'high' });

        // Second range: Extended context (100 subtitles before and after)
        const beforeContext = Math.max(0, startIndex - 100);
        const afterContext = Math.min(subtitles.length, startIndex + 100);
        ranges.push({ start: beforeContext, end: beforeStart, priority: 'medium' });
        ranges.push({ start: afterStart, end: afterContext, priority: 'medium' });

        // Final ranges: Beginning and remaining parts
        if (beforeContext > 0) ranges.push({ start: 0, end: beforeContext, priority: 'low' });
        if (afterContext < subtitles.length) ranges.push({ start: afterContext, end: subtitles.length, priority: 'low' });
    } else {
        // If starting from beginning, process sequentially
        ranges.push({ start: 0, end: subtitles.length, priority: 'normal' });
    }

    // Process each range
    for (const range of ranges) {
        let currentIndex = range.start;
        
        // Update message to show which section we're translating
        const progressMessage = range.priority === 'high' ? 
            'Translating subtitles around your start point...' :
            range.priority === 'medium' ? 
                'Translating nearby subtitles...' :
                'Translating remaining subtitles...';
        
        await createOrUpdateMessageSub(
            progressMessage,
            imdbId,
            season,
            episode,
            targetLanguage
        );

        while (currentIndex < range.end) {
            const remainingSubtitles = subtitles.slice(currentIndex, range.end);
            const { batch, nextIndex, tokenCount } = getNextBatch(remainingSubtitles, 0, targetTokens);
            
            if (batch.length === 0) break;

            const translatedBatch = await processBatch(batch, targetLanguage);
            
            // Store translated subtitles in their original positions
            translatedBatch.forEach((sub, i) => {
                processedSubtitles[currentIndex + i] = sub;
                processedCount++;
            });
            
            // Update progress
            const progress = Math.round((processedCount / subtitles.length) * 100);
            await updateTranslationProgress(
                imdbId,
                season,
                episode,
                targetLanguage,
                progress,
                processedCount,
                subtitles.length
            );

            currentIndex += nextIndex;
        }
    }

    // Filter out any nulls (shouldn't happen, but just in case)
    return processedSubtitles.filter(Boolean);
}

module.exports = {
    processSubtitles,
    estimateTokens,
    getNextBatch
}; 