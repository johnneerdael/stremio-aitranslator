const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;
let model;

/**
 * Initializes the Gemini translation provider
 * @param {string} apiKey - Gemini API key
 */
function initializeGemini(apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

/**
 * Clean up translated text by removing artifacts and normalizing spacing
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanTranslatedText(text) {
    return text
        .replace(/[™®©]/g, '')  // Remove trademark and copyright symbols
        .replace(/^[âÂ]™[aA][°º]|\s*[âÂ]™[aA][°º]\s*$/g, '')  // Remove â™a° or similar at start/end
        .replace(/^\s+|\s+$/g, '')  // Trim whitespace
        .replace(/\s+/g, ' ');  // Normalize spaces
}

/**
 * Translates a batch of texts using Gemini Flash
 * @param {string[]} texts - Array of texts to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string[]>} Array of translated texts
 */
async function translateWithGemini(texts, targetLanguage) {
    if (!model) {
        throw new Error('Gemini model not initialized. Call initializeGemini first.');
    }

    try {
        // Combine texts with clear separators for batch translation
        const combinedText = texts.map((text, index) => `[${index + 1}] ${text}`).join('\n\n');
        
        // Create prompt with clear instructions
        const prompt = `Translate the following English subtitles to ${targetLanguage}. 
Keep the numbered format [1], [2], etc. Maintain line breaks. 
Provide ONLY the translations without any additional text or explanations:

${combinedText}`;

        // Get translation from Gemini
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translatedText = response.text();

        // Split and clean the translated texts
        const translatedTexts = translatedText
            .split(/\[\d+\]/)  // Split by [number]
            .slice(1)  // Remove empty first element
            .map(text => cleanTranslatedText(text));

        // Verify we got all translations
        if (translatedTexts.length !== texts.length) {
            throw new Error('Translation count mismatch');
        }

        return translatedTexts;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

/**
 * Validates the Gemini API key by attempting a test translation
 * @param {string} apiKey - Gemini API key to validate
 * @returns {Promise<boolean>} Whether the key is valid
 */
async function validateGeminiKey(apiKey) {
    try {
        const tempGenAI = new GoogleGenerativeAI(apiKey);
        const tempModel = tempGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // Try a simple translation
        const result = await tempModel.generateContent('Translate "hello" to Dutch');
        await result.response;
        return true;
    } catch (error) {
        console.error('API key validation failed:', error);
        return false;
    }
}

module.exports = {
    initializeGemini,
    translateWithGemini,
    validateGeminiKey
};
