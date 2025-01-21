require('dotenv').config();
const languages = require('../lib/languages');

module.exports = {
    // Addon metadata
    id: process.env.APP_ID || 'com.stremio.aitranslator',
    version: process.env.APP_VERSION || '1.0.0',
    name: process.env.APP_NAME || 'Stremio AI Translator',
    description: process.env.APP_DESCRIPTION || 'Translates subtitles using Gemini AI',
    logo: 'https://raw.githubusercontent.com/JohninNL/stremio-aitranslator/master/static/logo.png',
    
    // Resources and catalogs
    resources: ['subtitles'],
    types: ['movie', 'series'],
    catalogs: [],
    idPrefixes: ['tt'],
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    },

    // Server configuration
    server: {
        port: process.env.PORT || 7000,
        host: process.env.HOST || '0.0.0.0'
    },

    // OpenSubtitles configuration
    opensubtitles: {
        apiKey: process.env.OPENSUBTITLES_API_KEY,
        appName: process.env.OPENSUBTITLES_APP_NAME
    },

    // Cache configuration
    cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.CACHE_TTL || '86400', 10),
        staleRevalidate: 3600,
        staleError: 7200
    },

    // User configuration schema
    userConfig: {
        opensubtitles_key: {
            title: 'OpenSubtitles API Key',
            type: 'text',
            required: true
        },
        opensubtitles_app: {
            title: 'OpenSubtitles App Name',
            type: 'text',
            required: true
        },
        gemini_key: {
            title: 'Gemini API Key',
            type: 'text',
            required: true
        },
        target_language: {
            title: 'Translate to',
            type: 'select',
            options: languages.getLanguageOptions(),
            required: true
        },
        cache_enabled: {
            title: 'Enable Translation Cache',
            type: 'checkbox',
            default: true
        },
        cache_ttl: {
            title: 'Cache Duration (hours)',
            type: 'number',
            default: 24
        }
    }
}; 