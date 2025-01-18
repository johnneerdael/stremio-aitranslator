const { addonBuilder } = require('stremio-addon-sdk');
const { translateSubtitles } = require('./translateProvider');
const ConfigService = require('./services/config');
const TranslationQueue = require('./services/queue');
const CacheService = require('./services/cache');
const DatabaseService = require('./services/database');

let config, queue, cache, db;

const manifest = {
    id: 'stremio-aitranslator',
    version: '1.3.25',
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
    if (!config) config = await ConfigService.getInstance();
    if (!queue) queue = await TranslationQueue.getInstance();
    if (!cache) cache = await CacheService.getInstance();
    if (!db) db = await DatabaseService.getInstance();

    const cacheKey = `${type}-${id}-${videoHash}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const result = await queue.add(async () => {
            const subtitles = await translateSubtitles(type, id);
            
            // Store in cache with metadata
            await cache.set(cacheKey, {
                subtitles,
                sourceLang: 'en',
                targetLang: await config.get('translateTo'),
                videoId: id,
                originalText: JSON.stringify(subtitles)
            });
            
            return subtitles;
        });

        return result;
    } catch (error) {
        console.error('Error in subtitles handler:', error);
        return { subtitles: [] };
    }
});

module.exports = builder.getInterface();
