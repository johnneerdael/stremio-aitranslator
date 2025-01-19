const { addonBuilder } = require('stremio-addon-sdk');
const { translateSubtitles } = require('./translateProvider');
const RedisService = require('./services/redis');

let redis;

function createManifest(apiKey) {
    // Create a unique ID based on the API key
    const uniqueId = apiKey ? `stremio-aitranslator-${Buffer.from(apiKey).toString('base64').substring(0, 10)}` : 'stremio-aitranslator';
    
    return {
        id: uniqueId,
        version: '1.5.3',
        name: 'AI Subtitle Translator',
        description: 'Translates subtitles using Google Gemini Flash 1.5 Free Tier',
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

    const manifest = createManifest(apiKey);
    return new addonBuilder(manifest);
}

const defaultBuilder = new addonBuilder(createManifest());

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

// Define handlers for the default builder
defineHandlers(defaultBuilder);

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
