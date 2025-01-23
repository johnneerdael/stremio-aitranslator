const nunjucks = require('nunjucks');
const path = require('path');
const logger = require('./logger');
const languages = require('./languages');

class TemplateHandler {
    constructor() {
        this.env = nunjucks.configure(path.join(__dirname, '../../templates'), {
            autoescape: true,
            noCache: process.env.NODE_ENV !== 'production'
        });
    }

    renderConfigPage(baseUrl, config = {}, version = '1.0.0') {
        try {
            return this.env.render('config.html', {
                base_url: baseUrl,
                version: version,
                config: config,
                languages: languages.getLanguageOptions().map(lang => ({
                    code: lang.value,
                    name: lang.label
                }))
            });
        } catch (error) {
            logger.error('Template rendering error:', error);
            throw error;
        }
    }
}

module.exports = new TemplateHandler();
