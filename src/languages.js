import geminiLanguages from '../langs/translateGeminiFlash.lang.json';

/**
 * Gets the language code from a language name
 * @param {string} languageName - Full language name
 * @returns {string|null} Language code or null if not found
 */
function getLanguageCode(languageName) {
    for (const [code, name] of Object.entries(geminiLanguages)) {
        if (name === languageName) {
            return code;
        }
    }
    return null;
}

/**
 * Gets the language name from a language code
 * @param {string} languageCode - Language code
 * @returns {string|null} Full language name or null if not found
 */
function getLanguageName(languageCode) {
    return geminiLanguages[languageCode] || null;
}

/**
 * Gets all supported languages
 * @returns {string[]} Array of language names
 */
function getAllLanguages() {
    return Object.values(geminiLanguages);
}

export const languages = {
    getLanguageCode,
    getLanguageName,
    getAllLanguages
}; 