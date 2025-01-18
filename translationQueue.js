const Queue = require('better-queue');
const { processSubtitles } = require('./processfiles');

/**
 * Translation queue optimized for Gemini Flash 1.5
 * - Processes one subtitle file at a time
 * - Handles retries automatically
 * - Maintains consistent processing speed
 */
const translationQueue = new Queue(async function (job, cb) {
    try {
        const { subtitles, imdbId, season, episode, targetLanguage } = job;
        
        console.log('Processing subtitles:', {
            imdbId,
            season,
            episode,
            targetLanguage,
            subtitleCount: subtitles.length
        });

        const result = await processSubtitles(
            subtitles,
            imdbId,
            season,
            episode,
            targetLanguage
        );

        cb(null, result);
    } catch (error) {
        console.error('Queue processing error:', error);
        cb(error);
    }
}, {
    concurrent: 1,      // Process one file at a time
    maxRetries: 3,      // Retry failed jobs up to 3 times
    retryDelay: 5000,   // Wait 5 seconds between retries
    afterProcessDelay: 1000  // Small delay between jobs
});

// Add event listeners for queue monitoring
translationQueue
    .on('task_finish', (taskId, result) => {
        console.log('Translation completed:', taskId);
    })
    .on('task_failed', (taskId, err) => {
        console.error('Translation failed:', taskId, err);
    })
    .on('task_retry', (taskId, err) => {
        console.log('Retrying translation:', taskId);
    });

module.exports = translationQueue; 