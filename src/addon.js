const { addonBuilder } = require('stremio-addon-sdk');
const { translateSubtitles } = require('./translateProvider');
const ConfigService = require('./services/config');
const TranslationQueue = require('./services/queue');
const CacheService = require('./services/cache');

let config, queue, cache;

const manifest = {
    id: 'stremio-aitranslator',
    version: '1.3.0',
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

    const cacheKey = `${type}-${id}-${videoHash}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const result = await queue.add(async () => {
            const subtitles = await translateSubtitles(type, id);
            await cache.set(cacheKey, subtitles);
            return subtitles;
        });

        return result;
    } catch (error) {
        console.error('Error in subtitles handler:', error);
        return { subtitles: [] };
    }
});

module.exports = builder.getInterface(); 