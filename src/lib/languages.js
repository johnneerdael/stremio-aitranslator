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

// Stremio language codes mapping
const STREMIO_TO_GEMINI = {
    'ar-AR': 'ar',
    'bg-BG': 'bg',
    'cs-CZ': 'cs',
    'da-DK': 'da',
    'de-DE': 'de',
    'el-GR': 'el',
    'en-US': 'en',
    'es-ES': 'es',
    'et-EE': 'et',
    'fi-FI': 'fi',
    'fr-FR': 'fr',
    'he-IL': 'he',
    'hi-IN': 'hi',
    'hu-HU': 'hu',
    'id-ID': 'id',
    'it-IT': 'it',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
    'lt-LT': 'lt',
    'lv-LV': 'lv',
    'nl-NL': 'nl',
    'no-NO': 'no',
    'pl-PL': 'pl',
    'pt-BR': 'pt',
    'pt-PT': 'pt',
    'ro-RO': 'ro',
    'ru-RU': 'ru',
    'sk-SK': 'sk',
    'sl-SI': 'sl',
    'sr-RS': 'sr',
    'sv-SE': 'sv',
    'th-TH': 'th',
    'tr-TR': 'tr',
    'uk-UA': 'uk',
    'vi-VN': 'vi',
    'zh-CN': 'zh',
    'zh-TW': 'zh-TW'
};

function getLanguageOptions() {
    // Return only languages supported by both Stremio and Gemini Flash
    return Object.entries(STREMIO_TO_GEMINI)
        .filter(([stremioCode]) => {
            const geminiCode = STREMIO_TO_GEMINI[stremioCode];
            return GEMINI_LANGUAGES[geminiCode] !== undefined;
        })
        .map(([stremioCode]) => ({
            name: GEMINI_LANGUAGES[STREMIO_TO_GEMINI[stremioCode]],
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