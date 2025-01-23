// Gemini Flash supported languages
// Source: https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/text-flash
const GEMINI_LANGUAGES = {
    'ar': 'Arabic',
    'bg': 'Bulgarian',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English',
    'et': 'Estonian',
    'fi': 'Finnish',
    'fr': 'French',
    'de': 'German',
    'el': 'Greek',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'no': 'Norwegian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sr': 'Serbian',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'es': 'Spanish',
    'sv': 'Swedish',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese'
};

// Stremio language codes mapping using ISO 639-2
const STREMIO_TO_GEMINI = {
    'ara': 'ar', // Arabic
    'bul': 'bg', // Bulgarian
    'zho': 'zh', // Chinese (Simplified)
    'cht': 'zh-TW', // Chinese (Traditional)
    'ces': 'cs', // Czech
    'dan': 'da', // Danish
    'nld': 'nl', // Dutch
    'eng': 'en', // English
    'est': 'et', // Estonian
    'fin': 'fi', // Finnish
    'fra': 'fr', // French
    'deu': 'de', // German
    'ell': 'el', // Greek
    'heb': 'he', // Hebrew
    'hin': 'hi', // Hindi
    'hun': 'hu', // Hungarian
    'ind': 'id', // Indonesian
    'ita': 'it', // Italian
    'jpn': 'ja', // Japanese
    'kor': 'ko', // Korean
    'lav': 'lv', // Latvian
    'lit': 'lt', // Lithuanian
    'nor': 'no', // Norwegian
    'pol': 'pl', // Polish
    'por': 'pt', // Portuguese
    'ron': 'ro', // Romanian
    'rus': 'ru', // Russian
    'srp': 'sr', // Serbian
    'slk': 'sk', // Slovak
    'slv': 'sl', // Slovenian
    'spa': 'es', // Spanish
    'swe': 'sv', // Swedish
    'tha': 'th', // Thai
    'tur': 'tr', // Turkish
    'ukr': 'uk', // Ukrainian
    'vie': 'vi'  // Vietnamese
};

function getLanguageOptions() {
    return Object.entries(STREMIO_TO_GEMINI)
        .filter(([stremioCode]) => GEMINI_LANGUAGES[STREMIO_TO_GEMINI[stremioCode]])
        .map(([stremioCode, geminiCode]) => ({
            name: GEMINI_LANGUAGES[geminiCode],
            value: stremioCode
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getGeminiLanguageCode(stremioCode) {
    return STREMIO_TO_GEMINI[stremioCode] || 'en';
}

function isLanguageSupported(stremioCode) {
    const geminiCode = STREMIO_TO_GEMINI[stremioCode];
    return GEMINI_LANGUAGES[geminiCode] !== undefined;
}

module.exports = {
    getLanguageOptions,
    getGeminiLanguageCode,
    isLanguageSupported,
    GEMINI_LANGUAGES,
    STREMIO_TO_GEMINI
}; 
