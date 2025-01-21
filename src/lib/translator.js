const axios = require('axios');
const logger = require('./logger');

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
                                original: {
                                    type: "string",
                                    description: "Original text line"
                                },
                                translated: {
                                    type: "string",
                                    description: "Translated text line"
                                },
                                isSubtitle: {
                                    type: "boolean",
                                    description: "Whether this is actual subtitle text (true) or metadata like timecodes (false)"
                                }
                            },
                            required: ["original", "translated", "isSubtitle"]
                        }
                    }
                },
                required: ["translations"]
            }
        }];
        
        // Translation state
        this.translationCache = new Map();
        this.pendingTranslations = new Map();
        this.isProcessingBulk = false;
    }

    configure(apiKey) {
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            }
        });
    }

    async translateBatch(texts, targetLang, isBulk = false) {
        try {
            if (!this.client) {
                throw new Error('Translator not configured. Call configure() first.');
            }

            const prompt = `Translate the following subtitle lines to ${targetLang}. 
For each line, determine if it's actual subtitle text or metadata (like timecodes or numbers).
${isBulk ? 'This is a bulk translation request, prioritize throughput over latency.' : 'This is a priority batch, optimize for quick response.'}

Input lines:
${texts.join('\n')}`;

            const response = await this.client.post('/generateContent', {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                tools: {
                    functionDeclarations: this.functionDeclarations
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

            return functionCall.args.translations;
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
        const initialBatchSize = 5;
        const initialBatches = 3;
        const bulkBatchSize = 50; // Larger batches for bulk processing

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
                    await new Promise(resolve => setTimeout(resolve, 500));
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
}

module.exports = new TranslatorService(); 