const fs = require('fs').promises;
const { translateWithGemini } = require('./translateProvider');
const { formatSubtitle, parseSRT, ensureSubtitleDirectory } = require('./subtitles');

class SubtitleProcessor {
    constructor() {
        this.subtitleCount = 0;
        this.timecodes = [];
        this.texts = [];
        this.translatedSubtitles = [];
    }

    async processSubtitles(filepath, imdbId, season = null, episode = null, targetLanguage) {
        try {
            // Read the original subtitle file
            const originalContent = await fs.readFile(filepath, { encoding: 'utf-8' });
            const parsedSubtitles = parseSRT(originalContent);
            this.subtitleCount = parsedSubtitles.length;

            // Process in optimal batch sizes for Gemini Flash
            const batchSize = 20; // Optimal batch size for Gemini Flash
            for (let i = 0; i < parsedSubtitles.length; i += batchSize) {
                const batch = parsedSubtitles.slice(i, i + batchSize);
                await this.processBatch(batch, targetLanguage);
                
                // Save progress after each batch
                await this.saveProgress(imdbId, season, episode, targetLanguage);
            }

            // Save final version
            await this.saveTranslatedSubtitles(imdbId, season, episode, targetLanguage);
            return true;
        } catch (error) {
            console.error('Error processing subtitles:', error);
            throw error;
        }
    }

    async processBatch(subtitleBatch, targetLanguage) {
        try {
            // Extract text for translation
            const textsToTranslate = subtitleBatch.map(sub => sub.text);
            
            // Translate batch
            const translatedTexts = await translateWithGemini(textsToTranslate, targetLanguage);
            
            // Store translated subtitles
            subtitleBatch.forEach((subtitle, index) => {
                this.translatedSubtitles.push({
                    index: subtitle.index,
                    timing: subtitle.timing,
                    text: translatedTexts[index]
                });
            });
        } catch (error) {
            console.error('Batch translation error:', error);
            throw error;
        }
    }

    async saveProgress(imdbId, season, episode, targetLanguage) {
        try {
            const dirPath = await ensureSubtitleDirectory(imdbId, season, targetLanguage);
            const fileName = season && episode ? 
                `${imdbId}-translated-${episode}-1.srt` : 
                `${imdbId}-translated-1.srt`;
            const filePath = `${dirPath}/${fileName}`;

            // Write current progress
            const output = this.translatedSubtitles.map(formatSubtitle).join('');
            await fs.writeFile(filePath, output);
        } catch (error) {
            console.error('Error saving progress:', error);
            throw error;
        }
    }

    async saveTranslatedSubtitles(imdbId, season, episode, targetLanguage) {
        try {
            const dirPath = await ensureSubtitleDirectory(imdbId, season, targetLanguage);
            const fileName = season && episode ? 
                `${imdbId}-translated-${episode}-1.srt` : 
                `${imdbId}-translated-1.srt`;
            const filePath = `${dirPath}/${fileName}`;

            // Write final version
            const output = this.translatedSubtitles.map(formatSubtitle).join('');
            await fs.writeFile(filePath, output);
            
            console.log('Translation completed and saved:', filePath);
        } catch (error) {
            console.error('Error saving final translation:', error);
            throw error;
        }
    }
}

async function processSubtitles(subtitles, imdbId, season = null, episode = null, targetLanguage) {
    const processor = new SubtitleProcessor();
    return processor.processSubtitles(subtitles[0], imdbId, season, episode, targetLanguage);
}

module.exports = { processSubtitles }; 