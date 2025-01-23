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
// Map between Stremio's ISO-639-2 and Gemini's supported language codes
const languageMap = {
    // Common languages
    eng: 'en',    // English
    spa: 'es',    // Spanish
    fre: 'fr',    // French
    ger: 'de',    // German
    ita: 'it',    // Italian
    por: 'pt',    // Portuguese
    rus: 'ru',    // Russian
    jpn: 'ja',    // Japanese
    kor: 'ko',    // Korean
    chi: 'zh',    // Chinese
    dut: 'nl',    // Dutch
    ara: 'ar',    // Arabic
    hin: 'hi',    // Hindi
    ben: 'bn',    // Bengali
    pol: 'pl',    // Polish
    tur: 'tr',    // Turkish
    ukr: 'uk',    // Ukrainian
    vie: 'vi',    // Vietnamese
    tha: 'th',    // Thai
    swe: 'sv',    // Swedish
    dan: 'da',    // Danish
    fin: 'fi',    // Finnish
    nor: 'no',    // Norwegian
    hun: 'hu',    // Hungarian
    cze: 'cs',    // Czech
    gre: 'el',    // Greek
    heb: 'he',    // Hebrew
    ron: 'ro',    // Romanian
    ind: 'id',    // Indonesian
};

function getLanguageOptions() {
    return Object.entries(languageMap).map(([iso639_2, geminiCode]) => ({
        value: iso639_2,
        label: getLanguageName(iso639_2)
    }));
}

function getLanguageName(iso639_2) {
    const names = {
        eng: 'English',
        spa: 'Spanish',
        fre: 'French',
        ger: 'German',
        ita: 'Italian',
        por: 'Portuguese',
        rus: 'Russian',
        jpn: 'Japanese',
        kor: 'Korean',
        chi: 'Chinese',
        dut: 'Dutch',
        ara: 'Arabic',
        hin: 'Hindi',
        ben: 'Bengali',
        pol: 'Polish',
        tur: 'Turkish',
        ukr: 'Ukrainian',
        vie: 'Vietnamese',
        tha: 'Thai',
        swe: 'Swedish',
        dan: 'Danish',
        fin: 'Finnish',
        nor: 'Norwegian',
        hun: 'Hungarian',
        cze: 'Czech',
        gre: 'Greek',
        heb: 'Hebrew',
        ron: 'Romanian',
        ind: 'Indonesian'
    };
    return names[iso639_2] || iso639_2;
}

function getGeminiLanguageCode(iso639_2) {
    return languageMap[iso639_2] || 'en'; // Default to English if code not found
}

function getISO639_2Code(geminiCode) {
    for (const [iso, gemini] of Object.entries(languageMap)) {
        if (gemini === geminiCode) return iso;
    }
    return 'eng'; // Default to English if code not found
}

module.exports = {
    getLanguageOptions,
    getLanguageName,
    getGeminiLanguageCode,
    getISO639_2Code
};
