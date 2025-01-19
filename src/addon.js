const { addonBuilder } = require('stremio-addon-sdk');
const { translateSubtitles } = require('./translateProvider');
const RedisService = require('./services/redis');
const LanguageService = require('./services/languages');

let redis;

async function createManifest(apiKey) {
    if (!redis) redis = await RedisService.getInstance();
    
    // Get configuration
    const translateTo = await redis.getConfig('translateTo');
    const cacheTime = await redis.getConfig('cacheTime');
    const maxConcurrent = await redis.getConfig('maxConcurrent');
    const debugMode = await redis.getConfig('debugMode');

    // Get language name
    const languageService = await LanguageService.getInstance();
    const languages = await languageService.getLanguages();
    const language = languages.find(l => l.code === translateTo);
    const languageName = language ? language.name : translateTo;

    // Create a unique ID based on the API key and configuration
    const configHash = Buffer.from(JSON.stringify({
        key: apiKey,
        lang: translateTo,
        cache: cacheTime,
        concurrent: maxConcurrent,
        debug: debugMode
    })).toString('base64').substring(0, 10);
    
    const uniqueId = `stremio-aitranslator-${configHash}`;
    
    return {
        id: uniqueId,
        version: '1.5.4',
        name: 'AI Subtitle Translator',
        description: `Translates subtitles to ${languageName} using Google Gemini AI`,
        types: ['movie', 'series'],
        resources: ['subtitles'],
        catalogs: [],
        idPrefixes: ['tt'],
        behaviorHints: {
            configurable: true,
            configurationRequired: true
        }
    };
}

async function createBuilder(apiKey) {
    if (!redis) redis = await RedisService.getInstance();
    
    // Only create builder if API key is configured
    if (!apiKey) {
        const configuredKey = await redis.getConfig('geminiApiKey');
        if (!configuredKey) {
            throw new Error('API key not configured');
        }
        apiKey = configuredKey;
    }

    const manifest = await createManifest(apiKey);
    return new addonBuilder(manifest);
}

let defaultBuilder;

// Initialize default builder
(async () => {
    const manifest = await createManifest();
    defaultBuilder = new addonBuilder(manifest);
    await defineHandlers(defaultBuilder);
})();

async function defineHandlers(builder) {
    builder.defineSubtitlesHandler(async ({ type, id, videoHash }) => {
        if (!redis) redis = await RedisService.getInstance();
        
        const apiKey = await redis.getConfig('geminiApiKey');
        if (!apiKey) {
            throw new Error('API key not configured');
        }

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
}


module.exports = {
    getInterface: async (apiKey) => {
        try {
            const builder = await createBuilder(apiKey);
            await defineHandlers(builder);
            return builder.getInterface();
        } catch (error) {
            console.error('Error creating interface:', error);
            return defaultBuilder.getInterface();
        }
    }
};
