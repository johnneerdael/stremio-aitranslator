const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

let genAI = null;
let model = null;

// Schema for subtitle translations
const translationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        texts: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.STRING,
                description: "Translated subtitle text"
            },
            description: "Array of translated subtitle texts"
        }
    },
    required: ["texts"]
};

/**
 * Initializes the Gemini client
 * @param {string} apiKey - Gemini API key
 */
function initializeGemini(apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: translationSchema,
            temperature: 0.1, // Lower temperature for more consistent translations
            topP: 0.8,
            topK: 40
        }
    });
}

/**
 * Validates the Gemini API key
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} Whether the key is valid
 */
async function validateGeminiKey(apiKey) {
    try {
        const tempGenAI = new GoogleGenerativeAI(apiKey);
        const tempModel = tempGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Try a simple translation to validate
        const result = await tempModel.generateContent("Translate 'Hello' to Spanish.");
        return result.response.text().includes("Hola");
    } catch (error) {
        console.error('API key validation error:', error);
        return false;
    }
}

/**
 * Translates an array of subtitle texts
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<Array<string>>} Translated texts
 */
async function translateBatch(texts, targetLanguage) {
    if (!model) {
        throw new Error('Gemini client not initialized');
    }

    try {
        const prompt = `You are a specialized subtitle translator. Translate the following texts to ${targetLanguage}.
        Important rules:
        - Preserve all line breaks and formatting
        - Maintain the emotional tone and cultural context
        - Keep special characters and punctuation
        - Ensure natural flow in the target language
        - Return only the translations in the specified JSON format

        Texts to translate:
        ${JSON.stringify(texts, null, 2)}`;

        const result = await model.generateContent(prompt);
        const response = JSON.parse(result.response.text());

        // Validate response structure
        if (!response.texts || !Array.isArray(response.texts) || response.texts.length !== texts.length) {
            throw new Error('Invalid translation response structure');
        }

        return response.texts;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

/**
 * Translates a single text
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, targetLanguage) {
    const result = await translateBatch([text], targetLanguage);
    return result[0];
}

module.exports = {
    initializeGemini,
    validateGeminiKey,
    translateBatch,
    translateText
}; 