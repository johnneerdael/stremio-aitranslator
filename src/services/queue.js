const Queue = require('better-queue');
const ConfigService = require('./config');
const debug = require('debug')('stremio:queue');

class TranslationQueue {
    static instance;
    queue = null;
    config = null;

    static async getInstance() {
        if (!TranslationQueue.instance) {
            TranslationQueue.instance = new TranslationQueue();
            await TranslationQueue.instance.init();
        }
        return TranslationQueue.instance;
    }

    async init() {
        this.config = await ConfigService.getInstance();
        const maxConcurrent = await this.config.get('maxConcurrent');

        this.queue = new Queue(async (task, cb) => {
            try {
                const result = await task();
                cb(null, result);
            } catch (error) {
                cb(error);
            }
        }, {
            concurrent: maxConcurrent,
            maxRetries: 3,
            retryDelay: 1000
        });

        if (await this.config.isDebugMode()) {
            this.queue.on('task_finish', (taskId, result) => {
                debug(`Task ${taskId} completed`);
            });

            this.queue.on('task_failed', (taskId, error) => {
                debug(`Task ${taskId} failed: ${error.message}`);
            });
        }
    }

    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push(task, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
}

module.exports = TranslationQueue; 