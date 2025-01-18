const Queue = require('better-queue');
const { processSubtitles } = require('./processfiles');
const { updateTranslationProgress } = require('./subtitles');

// Batch sizing configuration based on tokens
const BATCH_STRATEGY = {
    initial: {
        batchCount: 5,
        targetTokens: 1000    // Start small for quick feedback
    },
    fast: {
        batchCount: 5,
        targetTokens: 5000    // Medium batches
    },
    dynamic: {
        initialTokens: 20000,  // ~13k chars
        maxTokens: 100000,     // ~66k chars per batch
        tokenMultiplier: 2,    // Double tokens each batch
        tokenLimit: 1000000    // 1M tokens per minute limit
    }
};

// Token estimation
const TOKEN_ESTIMATES = {
    perCharacter: 1.5,    // Average tokens per character
    overheadPerBatch: 50  // Additional tokens for prompt and formatting
};

// Rate limiting state
const rateState = {
    requestsThisMinute: 0,
    requestsToday: 0,
    tokensThisMinute: 0,
    lastMinute: Date.now(),
    lastDay: Date.now(),
    
    reset() {
        const now = Date.now();
        if (now - this.lastMinute >= 60000) {
            this.requestsThisMinute = 0;
            this.tokensThisMinute = 0;
            this.lastMinute = now;
        }
        if (now - this.lastDay >= 86400000) {
            this.requestsToday = 0;
            this.lastDay = now;
        }
    },

    async checkLimits(estimatedTokens) {
        this.reset();
        
        if (this.requestsToday >= 1500) {
            throw new Error('Daily request limit reached');
        }

        if (this.requestsThisMinute >= 15) {
            const waitTime = 60000 - (Date.now() - this.lastMinute);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.reset();
        }

        if (this.tokensThisMinute + estimatedTokens > BATCH_STRATEGY.dynamic.tokenLimit) {
            const waitTime = 60000 - (Date.now() - this.lastMinute);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.reset();
        }

        this.requestsThisMinute++;
        this.requestsToday++;
        this.tokensThisMinute += estimatedTokens;
    }
};

// Create queue with optimized settings
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