// Gemini supported languages
// Source: https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/text
const GEMINI_LANGUAGES = {
    'ar': 'Arabic',
    'bn': 'Bengali',
    'bg': 'Bulgarian',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English',
    'et': 'Estonian',
    'fil': 'Filipino',
    'fi': 'Finnish',
    'fr': 'French',
    'de': 'German',
    'el': 'Greek',
    'gu': 'Gujarati',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'it': 'Italian',
    'ja': 'Japanese',
    'kn': 'Kannada',
    'ko': 'Korean',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'ms': 'Malay',
    'ml': 'Malayalam',
    'mr': 'Marathi',
    'no': 'Norwegian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'pa': 'Punjabi',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sr': 'Serbian',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'es': 'Spanish',
    'sw': 'Swahili',
    'sv': 'Swedish',
    'ta': 'Tamil',
    'te': 'Telugu',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'ur': 'Urdu',
    'vi': 'Vietnamese'
};

// Stremio language codes mapping
const STREMIO_TO_GEMINI = {
    'ar-AR': 'ar',
    'bg-BG': 'bg',
    'bn-BD': 'bn',
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
    'hr-HR': 'hr',
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
    // Return only languages supported by both Stremio and Gemini
    return Object.entries(STREMIO_TO_GEMINI)
        .filter(([stremioCode]) => {
            const geminiCode = STREMIO_TO_GEMINI[stremioCode];
            return GEMINI_LANGUAGES[geminiCode] !== undefined;
        })
        .map(([stremioCode]) => ({
            title: GEMINI_LANGUAGES[STREMIO_TO_GEMINI[stremioCode]],
            value: stremioCode
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
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