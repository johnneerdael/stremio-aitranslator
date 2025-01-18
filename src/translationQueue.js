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

        // Check daily request limit
        if (this.requestsToday >= 1500) {
            throw new Error('Daily request limit reached');
        }

        // Check per-minute request limit
        if (this.requestsThisMinute >= 15) {
            const waitTime = 60000 - (Date.now() - this.lastMinute);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.reset();
        }

        // Check token limit
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

// Queue processor with token-based batching
async function processWithStrategy(subtitles, job, cb) {
    try {
        let processedCount = 0;
        const totalSubtitles = subtitles.length;
        const results = [];

        // Helper function to get next batch based on target tokens
        function getNextBatch(targetTokens) {
            let batchSize = 1;
            let batchTokens = 0;
            const batch = [];

            while (processedCount + batchSize <= totalSubtitles && 
                   batchTokens < targetTokens && 
                   batchSize <= 100) { // Safety limit
                const nextSubtitle = subtitles[processedCount + batchSize - 1];
                const nextTokens = estimateTokens([nextSubtitle]);
                if (batchTokens + nextTokens > targetTokens) break;
                
                batch.push(nextSubtitle);
                batchTokens += nextTokens;
                batchSize++;
            }

            return batch;
        }

        // Process initial small batches for quick feedback
        for (let i = 0; i < BATCH_STRATEGY.initial.batchCount && processedCount < totalSubtitles; i++) {
            const batch = getNextBatch(BATCH_STRATEGY.initial.targetTokens);
            if (batch.length === 0) break;

            const estimatedTokens = estimateTokens(batch);
            await rateState.checkLimits(estimatedTokens);
            
            const result = await processBatch(batch, job, 'initial', processedCount, totalSubtitles);
            results.push(result);
            processedCount += batch.length;
        }

        // Process fast medium batches
        for (let i = 0; i < BATCH_STRATEGY.fast.batchCount && processedCount < totalSubtitles; i++) {
            const batch = getNextBatch(BATCH_STRATEGY.fast.targetTokens);
            if (batch.length === 0) break;

            const estimatedTokens = estimateTokens(batch);
            await rateState.checkLimits(estimatedTokens);
            
            const result = await processBatch(batch, job, 'fast', processedCount, totalSubtitles);
            results.push(result);
            processedCount += batch.length;
        }

        // Process remaining with dynamic scaling
        let currentTokenTarget = BATCH_STRATEGY.dynamic.initialTokens;
        while (processedCount < totalSubtitles) {
            const batch = getNextBatch(currentTokenTarget);
            if (batch.length === 0) break;

            const estimatedTokens = estimateTokens(batch);
            await rateState.checkLimits(estimatedTokens);
            
            const result = await processBatch(batch, job, 'dynamic', processedCount, totalSubtitles);
            results.push(result);
            processedCount += batch.length;
            
            // Scale up token target for next batch
            currentTokenTarget = Math.min(
                currentTokenTarget * BATCH_STRATEGY.dynamic.tokenMultiplier,
                BATCH_STRATEGY.dynamic.maxTokens
            );
        }

        cb(null, results);
    } catch (error) {
        console.error('Processing error:', error);
        cb(error);
    }
}

function estimateTokens(batch) {
    const totalChars = batch.reduce((sum, text) => sum + text.length, 0);
    return Math.ceil(totalChars * TOKEN_ESTIMATES.perCharacter + TOKEN_ESTIMATES.overheadPerBatch);
}

async function processBatch(batch, job, phase, processedCount, totalCount) {
    const { imdbId, season, episode, targetLanguage } = job;
    const progress = Math.round((processedCount / totalCount) * 100);
    
    console.log(`Processing ${phase} phase batch:`, {
        imdbId,
        season,
        episode,
        targetLanguage,
        batchSize: batch.length,
        progress: `${progress}%`,
        processedCount,
        totalCount
    });

    // Update progress in subtitle file
    await updateTranslationProgress(
        imdbId, 
        season, 
        episode, 
        targetLanguage, 
        progress,
        processedCount,
        totalCount
    );

    return processSubtitles(batch, imdbId, season, episode, targetLanguage);
}

// Create queue
const translationQueue = new Queue(processWithStrategy, {
    concurrent: 1,
    maxRetries: 3,
    retryDelay: 5000
});

// Add event listeners
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