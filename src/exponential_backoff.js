import * as _ from './underscore';
import log from './log';
import { delayPromise } from './utilities';

export class RetryableError extends Error {
    constructor(originalError, ...args) {
        super(...args);
        this.error = originalError;
    }
}

/**
 * @param {{ func: Function, expBackoffMillis: number, expBackoffMaxRepeats: number }} params
 */
export const retryWithExpBackoff = async (params = {}) => {
    const { func, expBackoffMillis, expBackoffMaxRepeats } = params;
    if (typeof func !== 'function') {
        throw new Error('Parameter "func" should be a function.');
    }
    if (typeof expBackoffMillis !== 'number') {
        throw new Error('Parameter "expBackoffMillis" should be a number.');
    }
    if (typeof expBackoffMaxRepeats !== 'number') {
        throw new Error('Parameter "expBackoffMaxRepeats" should be a number.');
    }

    for (let i = 0; ; i++) {
        let error;

        try {
            return await func();
        } catch (e) {
            error = e;
        }

        if (!(error instanceof RetryableError)) {
            throw error;
        }

        if (i >= expBackoffMaxRepeats - 1) {
            throw error.error;
        }

        const waitMillis = expBackoffMillis * (2 ** i);
        const randomizedWaitMillis = _.random(waitMillis, waitMillis * 2);

        if (i === Math.round(expBackoffMaxRepeats / 2)) {
            log.warning(`Retry failed ${i} times and will be repeated in ${randomizedWaitMillis}ms`, {
                originalError: error.error.message,
                errorDetails: error.error.details,
            });
        }

        await delayPromise(randomizedWaitMillis);
    }
};
