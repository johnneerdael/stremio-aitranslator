const axios = require('axios');
const logger = require('./logger');
const subtitleManager = require('./subtitleManager');
const { GoogleAICacheManager } = require('@google/generative-ai/server');

class TranslatorService {
    constructor() {
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash';
        this.functionDeclarations = [{
            name: "translateSubtitles",
            description: "Translates subtitle content while preserving formatting and timing",
            parameters: {
                type: "object",
                properties: {
                    translations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                original: { type: "string", description: "Original text line" },
                                translated: { type: "string", description: "Translated text line" },
                                isSubtitle: { type: "boolean", description: "Whether this is actual subtitle text (true) or metadata (false)" },
                                timing: { type: "string", description: "Timing information if present" }
                            },
                            required: ["original", "translated", "isSubtitle"]
                        }
                    }
                },
                required: ["translations"]
            }
        }];
        
        // Translation state with improved caching
        this.translationCache = new Map();
        this.pendingTranslations = new Map();
        this.isProcessingBulk = false;
        this.cacheManager = null;
    }

    configure(apiKey) {
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            }
        });
        this.cacheManager = new GoogleAICacheManager(apiKey);
    }

    async getCachedTranslation(cacheKey) {
        try {
            const cache = await this.cacheManager.get(cacheKey);
            return cache?.content;
        } catch (error) {
            logger.warn('Cache retrieval error:', error.message);
            return null;
        }
    }

    async cacheTranslation(cacheKey, translations) {
        try {
            const ttlSeconds = 259200; // 72 hours
            await this.cacheManager.create({
                key: cacheKey,
                content: translations,
                ttlSeconds
            });
        } catch (error) {
            logger.warn('Cache storage error:', error.message);
        }
    }

    validateSrtFormat(text) {
        const lines = text.split('\n');
        let isValid = true;
        let error = '';

        for (let i = 0; i < lines.length; i += 4) {
            // Check sequence number
            if (!/^\d+$/.test(lines[i]?.trim())) {
                isValid = false;
                error = 'Invalid sequence number';
                break;
            }
            // Check timecode format
            if (!/^\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}$/.test(lines[i+1]?.trim())) {
                isValid = false;
                error = 'Invalid timecode format';
                break;
            }
            // Check for subtitle text
            if (!lines[i+2]?.trim()) {
                isValid = false;
                error = 'Missing subtitle text';
                break;
            }
        }
        return { isValid, error };
    }

    preserveFormatting(text) {
        // Store formatting tags
        const tags = text.match(/<[^>]+>/g) || [];
        // Replace tags with placeholders
        let cleanText = text;
        tags.forEach((tag, i) => {
            cleanText = cleanText.replace(tag, `{{TAG${i}}}`);
        });
        return { cleanText, tags };
    }

    restoreFormatting(text, tags) {
        let restoredText = text;
        tags.forEach((tag, i) => {
            restoredText = restoredText.replace(`{{TAG${i}}}`, tag);
        });
        return restoredText;
    }

    async translateBatch(texts, targetLang, isBulk = false) {
        try {
            if (!this.client) {
                throw new Error('Translator not configured. Call configure() first.');
            }

            // Validate SRT format
            const { isValid, error } = this.validateSrtFormat(texts.join('\n'));
            if (!isValid) {
                throw new Error(`Invalid SRT format: ${error}`);
            }

            // Check cache first
            const cacheKey = `${texts.join('\n')}_${targetLang}`;
            const cachedResult = await this.getCachedTranslation(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }

            // Process formatting before translation
            const formattingMap = new Map();
            const processedTexts = texts.map((text, i) => {
                const { cleanText, tags } = this.preserveFormatting(text);
                if (tags.length) formattingMap.set(i, tags);
                return cleanText;
            });

            const prompt = `Translate the following subtitle lines to ${targetLang}. 
Preserve exact timing and formatting.
For each line, determine if it's actual subtitle text or metadata (like timecodes or numbers).
Maintain line breaks exactly as in the original.
${isBulk ? 'This is a bulk translation request, prioritize throughput over latency.' : 'This is a priority batch, optimize for quick response.'}

Input lines:
${processedTexts.join('\n')}`;

            const response = await this.client.post('/generateContent', {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                tools: {
                    functionDeclarations: this.functionDeclarations
                },
                generationConfig: {
                    temperature: 0.1, // Lower temperature for more consistent translations
                    topP: 0.8,
                    topK: 40
                },
                toolConfig: {
                    functionCallConfig: {
                        mode: "ANY",
                        allowedFunctionNames: ["translateSubtitles"]
                    }
                }
            });

            const functionCall = response.data.candidates[0]?.content?.parts[0]?.functionCall;
            if (!functionCall || functionCall.name !== "translateSubtitles") {
                throw new Error('Invalid translation response format');
            }

            // Cache successful translations
            const translations = functionCall.args.translations;
            
            // Restore formatting
            const restoredTranslations = translations.map((trans, i) => {
                if (formattingMap.has(i)) {
                    trans.translated = this.restoreFormatting(trans.translated, formattingMap.get(i));
                }
                return trans;
            });

            await this.cacheTranslation(cacheKey, restoredTranslations);
            return restoredTranslations;
        } catch (error) {
            logger.error('Translation error:', error.message);
            return texts.map(text => ({
                original: text,
                translated: text,
                isSubtitle: !text.includes('-->') && !/^\d+$/.test(text.trim())
            }));
        }
    }

    async translateSubtitleContent(content, targetLang) {
        const lines = content.split('\n');
        const translatedLines = new Array(lines.length);
        
        // Quick initial translation of first few batches
        const initialBatchSize = 10;
        const initialBatches = 3;
        const bulkBatchSize = 100;

        // Process initial batches quickly
        for (let i = 0; i < Math.min(initialBatches * initialBatchSize, lines.length); i += initialBatchSize) {
            const batch = lines.slice(i, i + initialBatchSize);
            try {
                const translations = await this.translateBatch(batch, targetLang, false);
                translations.forEach((translation, index) => {
                    const lineIndex = i + index;
                    translatedLines[lineIndex] = translation.isSubtitle ? translation.translated : batch[index];
                    this.translationCache.set(`${batch[index]}_${targetLang}`, translation.translated);
                });
            } catch (error) {
                logger.error('Initial batch translation error:', error);
                batch.forEach((line, index) => {
                    translatedLines[i + index] = line;
                });
            }
        }

        // Start bulk processing for remaining subtitles
        if (lines.length > initialBatches * initialBatchSize) {
            this.processBulkTranslations(
                lines.slice(initialBatches * initialBatchSize),
                targetLang,
                bulkBatchSize,
                translatedLines,
                initialBatches * initialBatchSize
            );
        }

        // Return what we have so far, bulk translations will update the cache
        return translatedLines.slice(0, initialBatches * initialBatchSize).join('\n');
    }

    async processBulkTranslations(lines, targetLang, batchSize, translatedLines, startIndex) {
        if (this.isProcessingBulk) return;
        this.isProcessingBulk = true;

        try {
            for (let i = 0; i < lines.length; i += batchSize) {
                const batch = lines.slice(i, i + batchSize);
                const translations = await this.translateBatch(batch, targetLang, true);
                
                translations.forEach((translation, index) => {
                    const lineIndex = startIndex + i + index;
                    translatedLines[lineIndex] = translation.isSubtitle ? translation.translated : batch[index];
                    this.translationCache.set(`${batch[index]}_${targetLang}`, translation.translated);
                });

                // Small delay between bulk batches
                if (i + batchSize < lines.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            logger.error('Bulk translation error:', error);
        } finally {
            this.isProcessingBulk = false;
        }
    }

    // Get cached translation if available
    getCachedTranslation(text, targetLang) {
        return this.translationCache.get(`${text}_${targetLang}`);
    }

    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    async checkRateLimits() {
        // Implement rate limiting logic here if needed
        // For now, we're using simple delays between batches
        return true;
    }

    async translateAndSave(type, language, imdbId, subtitleContent, season = null, episode = null) {
        try {
            const count = await subtitleManager.getSubtitleCount(type, language, imdbId, season);
            const translatedContent = await this.translateBatch(subtitleContent, language);
            const filePath = await subtitleManager.saveSubtitle(
                type, 
                language, 
                imdbId, 
                translatedContent, 
                count + 1, 
                season, 
                episode
            );
            return filePath;
        } catch (error) {
            logger.error('Error in translateAndSave:', error.message);
            throw error;
        }
    }
}

module.exports = new TranslatorService(); 
