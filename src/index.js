const { addonBuilder } = require('stremio-addon-sdk');
const translator = require('./lib/translator');
const opensubtitles = require('./lib/opensubtitles');
const languages = require('./lib/languages');
const logger = require('./lib/logger');

const manifest = {
    id: 'org.stremio.aitranslator',
    version: '1.0.0',
    name: 'AI Subtitle Translator',
    description: 'Translates subtitles using Gemini AI',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles'],
    idPrefixes: ['tt']
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ type, id, season, episode }) => {
    try {
        const config = await builder.getConfig();
        if (!config?.opensubtitles_api_key || !config?.opensubtitles_app || !config?.target_language) {
            throw new Error('Missing required configuration');
        }

        // Configure clients
        opensubtitles.configure(config.opensubtitles_api_key, config.opensubtitles_app);
        translator.configure(config.gemini_api_key);

        // Get subtitles from OpenSubtitles
        const subtitles = await opensubtitles.getSubtitles(type, id, season, episode);
        if (!subtitles.length) {
            return { subtitles: [] };
        }

        // Process each subtitle
        const translatedSubtitles = await Promise.all(
            subtitles.map(async (sub) => {
                try {
                    const downloadLink = await opensubtitles.downloadSubtitle(sub.attributes.files[0].file_id);
                    if (!downloadLink) return null;

                    const response = await fetch(downloadLink);
                    const content = await response.text();

                    const translatedPath = await translator.translateAndSave(
                        type,
                        config.target_language,
                        id,
                        content,
                        season,
                        episode
                    );

                    return {
                        id: `${sub.id}_translated`,
                        url: translatedPath,
                        lang: config.target_language,
                        fps: sub.attributes.fps
                    };
                } catch (error) {
                    logger.error(`Error processing subtitle: ${error.message}`);
                    return null;
                }
            })
        );

        return {
            subtitles: translatedSubtitles.filter(Boolean),
            cacheMaxAge: 259200, // 72 hours
            staleRevalidate: true,
            staleError: true
        };
    } catch (error) {
        logger.error(`Subtitle handler error: ${error.message}`);
        return { subtitles: [] };
    }
});

module.exports = builder.getInterface(); 