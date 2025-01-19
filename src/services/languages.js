const fs = require('fs').promises;
const path = require('path');

class LanguageService {
    static instance;
    languages = null;

    static async getInstance() {
        if (!LanguageService.instance) {
            LanguageService.instance = new LanguageService();
            await LanguageService.instance.init();
        }
        return LanguageService.instance;
    }

    async init() {
        try {
            const langFile = await fs.readFile(
                path.join(__dirname, '../../langs/translateGeminiFlash.lang.json'),
                'utf-8'
            );
            const langData = JSON.parse(langFile);
            this.languages = langData.languages;
        } catch (error) {
            console.error('Error loading languages:', error);
            this.languages = [{ code: 'dut', name: 'Dutch' }];
        }
    }

    async getLanguages() {
        return this.languages;
    }

    async getLanguageName(code) {
        const lang = this.languages.find(l => l.code === code);
        return lang ? lang.name : code;
    }
}

module.exports = LanguageService;
