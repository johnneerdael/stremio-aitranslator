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
                text: `You are a professional subtitle translator specializing in ${targetLang} translations.
Translate the following SRT subtitle lines to ${targetLang}.

Key requirements:
1. Preserve exact SRT formatting including sequence numbers and timecodes
2. Keep all HTML-style formatting tags (e.g. <i>, <b>) intact
3. Maintain natural flow and conversational style in ${targetLang}
4. Keep subtitle length similar to source for proper display timing
5. Preserve line breaks and spacing exactly as in source
6. Do not translate proper names, numbers, or technical terms

Input subtitles:
${processedTexts.join('\n')}

Translate only the subtitle text, keeping all formatting and timing information exactly as is.`
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
            // Group lines into subtitle blocks (4 lines per block typically)
            const subtitleBlocks = [];
            for (let i = 0; i < lines.length; i += 4) {
                subtitleBlocks.push(lines.slice(i, i + 4).join('\n'));
            }

            // Process blocks in parallel with rate limiting
            const concurrentLimit = 3;
            for (let i = 0; i < subtitleBlocks.length; i += concurrentLimit) {
                const batch = subtitleBlocks.slice(i, i + concurrentLimit);
                const translations = await Promise.all(
                    batch.map(block => this.translateWithRetry(block, targetLang))
                );

                // Update translated lines
                translations.forEach((translation, index) => {
                    const blockIndex = i + index;
                    const lines = translation.split('\n');
                    lines.forEach((line, lineIndex) => {
                        translatedLines[startIndex + (blockIndex * 4) + lineIndex] = line;
                    });
                });

                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 100));
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

    async validateTranslation(original, translated, targetLang) {
        try {
            // Check length ratio (shouldn't be too different from original)
            const lengthRatio = translated.length / original.length;
            if (lengthRatio < 0.5 || lengthRatio > 2.0) {
                logger.warn(`Translation length ratio suspicious: ${lengthRatio}`);
                return false;
            }

            // Verify timing codes weren't modified
            const originalTiming = original.match(/\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}/g);
            const translatedTiming = translated.match(/\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}/g);
            if (JSON.stringify(originalTiming) !== JSON.stringify(translatedTiming)) {
                logger.error('Timing codes were modified in translation');
                return false;
            }

            // Verify HTML tags preserved
            const originalTags = original.match(/<[^>]+>/g) || [];
            const translatedTags = translated.match(/<[^>]+>/g) || [];
            if (JSON.stringify(originalTags) !== JSON.stringify(translatedTags)) {
                logger.error('HTML formatting tags were modified');
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Translation validation error:', error);
            return false;
        }
    }

    async checkRateLimits() {
        // Implement rate limiting logic here if needed
        // For now, we're using simple delays between batches
        return true;
    }

    async translateWithRetry(text, targetLang, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const result = await this.model.generateContent([{
                    text: text
                }]);
                
                const translation = result.response.text();
                if (await this.validateTranslation(text, translation, targetLang)) {
                    return translation;
                }
                
                // If validation failed, throw error to trigger retry
                throw new Error('Translation validation failed');
            } catch (error) {
                logger.warn(`Translation attempt ${attempt + 1} failed:`, error);
                if (attempt === maxRetries - 1) throw error;
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
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
