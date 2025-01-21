const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const config = require('./config/config');
const languages = require('./lib/languages');
const opensubtitles = require('./lib/opensubtitles');
const translator = require('./lib/translator');
const logger = require('./lib/logger');

const builder = new addonBuilder({
    id: config.id,
    version: config.version,
    name: config.name,
    description: config.description,
    logo: config.logo,
    background: config.background,
    resources: ['subtitles'],
    types: ['movie', 'series'],
    catalogs: [],
    idPrefixes: ['tt'],
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    },
    config: [
        {
            key: 'opensubtitles_key',
            title: 'OpenSubtitles API Key',
            type: 'text',
            required: true
        },
        {
            key: 'gemini_key',
            title: 'Gemini API Key',
            type: 'text',
            required: true
        },
        {
            key: 'target_language',
            title: 'Translate to',
            type: 'select',
            required: true,
            options: languages.getLanguageOptions()
        },
        {
            key: 'cache_enabled',
            title: 'Enable Translation Cache',
            type: 'checkbox',
            required: false,
            default: true
        },
        {
            key: 'cache_ttl',
            title: 'Cache Duration (hours)',
            type: 'number',
            required: false,
            default: 24
        }
    ]
});

builder.defineSubtitlesHandler(async ({ type, id, extra, config: userConfig }) => {
    if (!userConfig.opensubtitles_key || !userConfig.gemini_key || !userConfig.target_language) {
        logger.warn('Missing required configuration');
        return { 
            subtitles: [],
            cacheMaxAge: 3600,
            staleError: 7200
        };
    }

    try {
        // Parse the video ID
        let imdbId, season, episode;
        if (type === 'series') {
            [imdbId, season, episode] = id.split(':');
        } else {
            imdbId = id;
        }

        // Return loading subtitle while we fetch and translate
        const subtitles = [{
            id: 'loading',
            url: `${config.logo.replace('logo.png', 'loading.srt')}`,
            lang: userConfig.target_language
        }];

        // Configure services with user settings
        opensubtitles.configure(userConfig.opensubtitles_key);
        translator.configure(userConfig.gemini_key);
        
        // Start the subtitle fetching process
        const results = await opensubtitles.getSubtitles(type, imdbId, season, episode);
        
        if (results && results.length > 0) {
            for (const sub of results) {
                try {
                    // Download the subtitle content
                    const downloadUrl = await opensubtitles.downloadSubtitle(sub.attributes.files[0].file_id);
                    if (!downloadUrl) continue;

                    // Fetch the subtitle content
                    const response = await fetch(downloadUrl);
                    const content = await response.text();

                    // Translate the content
                    const translatedContent = await translator.translateSubtitleContent(content, userConfig.target_language);

                    // Create a Blob with the translated content
                    const blob = new Blob([translatedContent], { type: 'text/plain' });
                    const blobUrl = URL.createObjectURL(blob);

                    subtitles.push({
                        id: `${sub.attributes.files[0].file_id}-${userConfig.target_language}`,
                        url: blobUrl,
                        lang: userConfig.target_language
                    });
                } catch (error) {
                    logger.error('Error processing subtitle:', error);
                    continue;
                }
            }
        }

        return { 
            subtitles,
            cacheMaxAge: userConfig.cache_enabled ? (userConfig.cache_ttl || 24) * 3600 : 3600,
            staleRevalidate: 3600,
            staleError: 7200
        };
    } catch (error) {
        logger.error('Error in subtitles handler:', error);
        return { 
            subtitles: [],
            cacheMaxAge: 3600,
            staleError: 7200
        };
    }
});

serveHTTP(builder.getInterface(), { 
    port: config.server.port,
    cacheMaxAge: 3600
}); 