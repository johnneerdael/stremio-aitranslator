const axios = require('axios');
const logger = require('./logger');
const subtitleManager = require('./subtitleManager');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class TranslatorService {
    constructor() {
        this.model = null;
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
        
        // Simple in-memory cache
        this.translationCache = new Map();
        this.pendingTranslations = new Map();
        this.isProcessingBulk = false;
    }

    configure(apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-001", // Use specific version for stability
            generationConfig: {
                temperature: 0.1, // Lower temperature for more consistent translations
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
                stopSequences: ["</s>"]
            }
        });
    }

    async getCachedTranslation(cacheKey) {
        return this.translationCache.get(cacheKey);
    }

    async cacheTranslation(cacheKey, translations) {
        this.translationCache.set(cacheKey, translations);
        
        // Implement cache expiration after 72 hours
        setTimeout(() => {
            this.translationCache.delete(cacheKey);
        }, 259200000); // 72 hours in milliseconds
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
            // Check cache first
            const cacheKey = `${texts.join('\n')}_${targetLang}`;
            const cachedResult = await this.getCachedTranslation(cacheKey);
            if (cachedResult) return cachedResult;

            // Process formatting before translation
            const formattingMap = new Map();
            const processedTexts = texts.map((text, i) => {
                const { cleanText, tags } = this.preserveFormatting(text);
                if (tags.length) formattingMap.set(i, tags);
                return cleanText;
            });

            const prompt = {
                text: `Translate the following SRT subtitle lines to ${targetLang}.
Rules:
1. Preserve exact timing and sequence numbers
2. Preserve all HTML-style formatting tags (like <i>, <b>)
3. Keep line breaks exactly as in original
4. Do not translate numbers or timecodes
5. Maintain subtitle length to fit on screen (similar length to source)

Input subtitles:
${processedTexts.join('\n')}`
            };

            const result = await this.model.generateContent([prompt]);
            const response = await result.response;

            // Validate and restore formatting
            const translatedLines = response.text().split('\n');
            const processedLines = translatedLines.map((line, i) => {
                if (formattingMap.has(i)) {
                    return this.restoreFormatting(line, formattingMap.get(i));
                }
                return line;
            });

            // Cache successful translations
            await this.cacheTranslation(cacheKey, processedLines);
            return processedLines;
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

    async processBulkTranslations(lines, targetLang, translatedLines, startIndex) {
        if (this.isProcessingBulk) return;
        this.isProcessingBulk = true;

        try {
            let currentBatch = [];
            let currentTokens = 0;
            const MAX_TOKENS_PER_BATCH = 8000; // Safe limit for Gemini Flash

            for (let i = 0; i < lines.length; i++) {
                const lineTokens = await this.estimateBatchSize([lines[i]]);
                
                if (currentTokens + lineTokens > MAX_TOKENS_PER_BATCH) {
                    // Process current batch
                    const translations = await this.translateBatch(currentBatch, targetLang, true);
                    translations.forEach((translation, index) => {
                        const lineIndex = startIndex + i - currentBatch.length + index;
                        translatedLines[lineIndex] = translation;
                    });
                    
                    currentBatch = [];
                    currentTokens = 0;
                    
                    // Add delay between batches
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                currentBatch.push(lines[i]);
                currentTokens += lineTokens;
            }

            // Process final batch
            if (currentBatch.length > 0) {
                const translations = await this.translateBatch(currentBatch, targetLang, true);
                translations.forEach((translation, index) => {
                    const lineIndex = startIndex + lines.length - currentBatch.length + index;
                    translatedLines[lineIndex] = translation;
                });
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

    async estimateBatchSize(texts) {
        try {
            const result = await this.model.countTokens(texts.join('\n'));
            return result.totalTokens;
        } catch (error) {
            // Fallback to rough estimation
            return Math.ceil(texts.join('\n').length / 4);
        }
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
