const { addonBuilder } = require('stremio-addon-sdk');
const { processSubtitles } = require('./processfiles');
const { createOrUpdateMessageSub, generateSubtitlePath } = require('./subtitles');
const { getSubtitles } = require('./opensubtitles');
const fs = require('fs').promises;
const translationQueue = require('./translationQueue');

// Cache configuration
const CACHE_CONFIG = {
    CACHE_MAX_AGE: 24 * 60 * 60, // 24 hours for completed translations
    STALE_REVALIDATE_AGE: 4 * 60 * 60, // 4 hours stale-while-revalidate
    STALE_ERROR_AGE: 7 * 24 * 60 * 60, // 7 days stale-if-error
    PROGRESS_MAX_AGE: 30, // 30 seconds for in-progress
};

const manifest = {
    id: 'org.stremio.aitranslator',
    version: '1.3.0',
    name: 'AI Subtitle Translator',
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

builder.defineSubtitlesHandler(async ({ type, id, extra = {}, config = {} }) => {
    // Extract IMDB ID (remove 'tt' prefix if present)
    const imdbId = id.startsWith('tt') ? id : `tt${id}`;
    
    // Parse season and episode for series
    let season = null;
    let episode = null;
    if (type === 'series' && extra.query) {
        const match = extra.query.match(/s(\d+)e(\d+)/i);
        if (match) {
            season = match[1];
            episode = match[2];
        }
    }

    // Get target language from config
    const targetLanguage = config.targetLanguage || 'eng';

    // Handle start time offset (in seconds)
    const startTime = extra.startTime || 0;
    const hasTimeOffset = startTime > 0;

    try {
        // Check for completed translation
        const finalPath = generateSubtitlePath(imdbId, season, episode, targetLanguage, false);
        const placeholderPath = generateSubtitlePath(imdbId, season, episode, targetLanguage, true);
        const offsetPath = hasTimeOffset ? generateSubtitlePath(imdbId, season, episode, targetLanguage, false, startTime) : null;

        try {
            // Check if final translation exists
            await fs.access(finalPath);

            if (hasTimeOffset) {
                try {
                    // Check if time-adjusted version exists
                    await fs.access(offsetPath);
                } catch {
                    // Create time-adjusted version
                    await adjustSubtitleTiming(finalPath, offsetPath, startTime);
                }

                // Return time-adjusted translation
                return {
                    subtitles: [{
                        id: `${imdbId}-${targetLanguage}-${startTime}`,
                        url: `http://127.0.0.1:11470/subtitles.vtt?from=file://${offsetPath}`,
                        lang: targetLanguage
                    }],
                    cacheMaxAge: CACHE_CONFIG.CACHE_MAX_AGE,
                    staleRevalidate: CACHE_CONFIG.STALE_REVALIDATE_AGE,
                    staleError: CACHE_CONFIG.STALE_ERROR_AGE
                };
            }

            // Return completed translation with long cache
            return {
                subtitles: [{
                    id: `${imdbId}-${targetLanguage}`,
                    url: `http://127.0.0.1:11470/subtitles.vtt?from=file://${finalPath}`,
                    lang: targetLanguage
                }],
                cacheMaxAge: CACHE_CONFIG.CACHE_MAX_AGE,
                staleRevalidate: CACHE_CONFIG.STALE_REVALIDATE_AGE,
                staleError: CACHE_CONFIG.STALE_ERROR_AGE
            };
        } catch (err) {
            // Check for in-progress translation
            try {
                const placeholderStats = await fs.stat(placeholderPath);
                const ageInMinutes = (Date.now() - placeholderStats.mtime.getTime()) / (60 * 1000);
                
                if (ageInMinutes < 5) {
                    // Translation in progress, return placeholder with short cache
                    return {
                        subtitles: [{
                            id: `${imdbId}-${targetLanguage}-progress`,
                            url: `http://127.0.0.1:11470/subtitles.vtt?from=file://${placeholderPath}`,
                            lang: targetLanguage
                        }],
                        cacheMaxAge: CACHE_CONFIG.PROGRESS_MAX_AGE
                    };
                }
            } catch (err) {
                // No placeholder exists or it's too old
            }

            // Get source subtitles
            const sourceSubtitles = await getSubtitles(type, imdbId, season, episode);
            if (!sourceSubtitles || sourceSubtitles.length === 0) {
                await createOrUpdateMessageSub(
                    'No source subtitles found.',
                    imdbId,
                    season,
                    episode,
                    targetLanguage
                );
                return { subtitles: [] };
            }

            // Start new translation with prioritized start time
            await createOrUpdateMessageSub(
                hasTimeOffset ? 
                    'Starting translation from your current position...' :
                    'Starting subtitle translation...\nThis may take a few minutes.',
                imdbId,
                season,
                episode,
                targetLanguage
            );

            // Start translation process
            processSubtitles(sourceSubtitles, {
                imdbId,
                season,
                episode,
                targetLanguage,
                startTime
            }).catch(error => {
                console.error('Translation process error:', error);
                createOrUpdateMessageSub(
                    'Translation error occurred. Please try again.',
                    imdbId,
                    season,
                    episode,
                    targetLanguage
                );
            });

            // Return placeholder immediately
            return {
                subtitles: [{
                    id: `${imdbId}-${targetLanguage}-starting`,
                    url: `http://127.0.0.1:11470/subtitles.vtt?from=file://${placeholderPath}`,
                    lang: targetLanguage
                }],
                cacheMaxAge: CACHE_CONFIG.PROGRESS_MAX_AGE
            };
        }
    } catch (error) {
        console.error('Error handling subtitle request:', error);
        return { subtitles: [] };
    }
});

module.exports = builder.getInterface(); 