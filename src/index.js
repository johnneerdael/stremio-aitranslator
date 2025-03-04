const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fs = require('fs');
const express = require('express');
const translator = require('./lib/translator');
const opensubtitles = require('./lib/opensubtitles');
const languages = require('./lib/languages');
const logger = require('./lib/logger');
const path = require('path');
const templateHandler = require('./lib/templateHandler');

const app = express();

const manifest = {
    id: 'org.stremio.aitranslator',
    version: '1.0.0',
    name: 'AI Subtitle Translator',
    description: 'Translates subtitles using Gemini AI',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles'],
    idPrefixes: ['tt'],
    logo: '/static/logo.png',
    background: '/static/wallpaper.png',
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    },
    config: [
        {
            key: 'opensubtitles_api_key',
            title: 'OpenSubtitles API Key',
            type: 'text',
            required: true
        },
        {
            key: 'opensubtitles_app',
            title: 'OpenSubtitles App Name',
            type: 'text',
            required: true
        },
        {
            key: 'gemini_api_key',
            title: 'Gemini API Key',
            type: 'text',
            required: true
        },
        {
            key: 'target_language',
            title: 'Target Language',
            type: 'select',
            required: true,
            options: languages.getLanguageOptions(),
            default: 'nld'
        }
    ]
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ type, id, season, episode }) => {
    try {
        const config = await builder.getConfig();
        if (!config?.opensubtitles_api_key || !config?.opensubtitles_app || !config?.target_language) {
            throw new Error('Missing required configuration');
        }

        // Return loading subtitle immediately
        const loadingSubtitle = {
            id: 'loading',
            url: '/static/loading.srt',
            lang: config.target_language
        };

        // Configure clients
        opensubtitles.configure(config.opensubtitles_api_key, config.opensubtitles_app);
        translator.configure(config.gemini_api_key);

        // Get subtitles from OpenSubtitles
        const subtitles = await opensubtitles.getSubtitles(type, id, season, episode);
        if (!subtitles.length) {
            return { subtitles: [loadingSubtitle] };
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

        const validSubtitles = translatedSubtitles.filter(Boolean);
        
        if (!validSubtitles.length) {
            logger.warn(`No valid subtitles found for ${type} ${id}`);
            return { subtitles: [loadingSubtitle] };
        }

        return {
            subtitles: validSubtitles,
            cacheMaxAge: 259200, // 72 hours
            staleRevalidate: true,
            staleError: true
        };
    } catch (error) {
        logger.error(`Subtitle handler error: ${error.message}`);
        logger.warn(`Subtitle handler error: ${error.message}`);
        return { subtitles: [loadingSubtitle] };
    }
});

// Use relative path for static directory
const staticDir = 'static';
const subtitlesDir = path.join(__dirname, '..', 'subtitles');

try {
    // Ensure subtitles directory exists
    if (!fs.existsSync(subtitlesDir)) {
        fs.mkdirSync(subtitlesDir, { recursive: true });
        logger.info('Created subtitles directory');
    }

    // Verify static files exist (using absolute path for checking)
    const absoluteStaticDir = path.join(__dirname, '..', staticDir);
    const requiredFiles = ['loading.srt', 'logo.png', 'wallpaper.png'];
    for (const file of requiredFiles) {
        const filePath = path.join(absoluteStaticDir, file);
        if (!fs.existsSync(filePath)) {
            logger.error(`Missing required static file: ${filePath}`);
            throw new Error(`Missing required static file: ${file}`);
        } else {
            logger.info(`Found static file: ${filePath}`);
        }
    }
} catch (error) {
    logger.error('Error setting up directories:', error);
    process.exit(1);
}

// Serve static files
app.use('/static', express.static('static'));
app.use('/assets', express.static('static')); // Alias for backward compatibility

// Configuration page route
app.get('/configure', (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const html = templateHandler.renderConfigPage(
            baseUrl,
            {}, // Default config
            manifest.version
        );
        res.send(html);
    } catch (error) {
        logger.error('Configuration page error:', error);
        res.status(500).send('Error loading configuration page');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Start the server
serveHTTP(builder.getInterface(), {
    app,
    port: process.env.PORT || 7000,
    host: process.env.HOST || '0.0.0.0',
    cache: {
        max: 1000,
        maxAge: 259200 * 1000 // 72 hours in milliseconds
    },
    cors: true
});

