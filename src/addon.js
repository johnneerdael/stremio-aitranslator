const { addonBuilder } = require('stremio-addon-sdk');
const { translateSubtitles } = require('./translateProvider');
const RedisService = require('./services/redis');

let redis;

const manifest = {
    id: 'stremio-aitranslator',
    version: '1.4.1',
    name: 'Auto Subtitle Translate from English to Dutch',
    description: 'Translates subtitles using Google Gemini Flash 1.5 Free Tier',
    types: ['movie', 'series'],
    resources: ['subtitles'],
    catalogs: [],
    idPrefixes: ['tt'], // IMDB ID prefix
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    }
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ type, id, videoHash }) => {
    if (!redis) redis = await RedisService.getInstance();

    const cacheKey = `${type}-${id}-${videoHash}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    try {
        // Check queue length to implement rate limiting
        const queueLength = await redis.getQueueLength('translations');
        if (queueLength > 5) {
            throw new Error('Too many pending translations');
        }

        // Add to queue and process
        await redis.addToQueue('translations', { type, id });
        const subtitles = await translateSubtitles(type, id);
        
        // Store in cache with metadata
        await redis.set(cacheKey, {
            subtitles,
            sourceLang: 'en',
            targetLang: await redis.getConfig('translateTo'),
            videoId: id,
            originalText: JSON.stringify(subtitles)
        });
        
        return subtitles;
    } catch (error) {
        console.error('Error in subtitles handler:', error);
        return { subtitles: [] };
    }
});

module.exports = builder.getInterface();
