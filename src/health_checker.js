import * as _ from './underscore';
import { cryptoRandomObjectId, timeoutPromise } from './utilities';

const CHECK_TYPES = {
    MONGODB_READ: 'MONGODB_READ',
    MONGODB_WRITE: 'MONGODB_WRITE',
    REDIS: 'REDIS',
};
const CHECK_TYPES_ARRAY = Object.values(CHECK_TYPES);

/**
 * Provides health-checking functionality to ensure that connection to Redis and MongoDB is working.
 *
 * Example use:
 *
 * ```javascript
 * const redis = new Redis();
 * const mongo = await MongoClient.connect('mongodb://127.0.0.1:3001/my-db');
 *
 * const checks = [{
 *     client: redis,
 *     type: HealthChecker.CHECK_TYPES.REDIS,
 * }, {
 *     client: mongo.db('my-db'),
 *     type: HealthChecker.CHECK_TYPES.MONGODB_READ,
 * }];
 *
 * const checker = new HealthChecker({ checks });
 * setInterval(() => checker.ensureIsHealthy().then(() => console.log('ok'), err => console.log(err)), 5000);
 * ```
 */
class HealthChecker {
    constructor(options) {
        const {
            checks,
            redisPrefix = 'health-check',
            redisTtlSecs = 15,
            checkTimeoutMillis = 15000,
            mongoDbWriteTestCollection = 'healthCheckPlayground',
            mongoDbWriteTestRemoveOlderThanSecs = 15,
        } = options;

        if (!_.isArray(checks)) throw new Error('Parameter "check" must be an array');
        checks.map((check) => this._validateCheck(check));

        this.checks = checks;
        this.redisPrefix = redisPrefix;
        this.redisTtlSecs = redisTtlSecs;
        this.checkTimeoutMillis = checkTimeoutMillis;
        this.mongoDbWriteTestCollection = mongoDbWriteTestCollection;
        this.mongoDbWriteTestRemoveOlderThanSecs = mongoDbWriteTestRemoveOlderThanSecs;
    }

    async ensureIsHealthy() {
        for (const check of this.checks) {
            try {
                const checkPromise = this._performCheck(check);
                await timeoutPromise(checkPromise, this.checkTimeoutMillis, 'Check has timed-out');
            } catch (err) {
                throw new Error(`Health check test "${check.type}" failed with an error: ${err.message}"`);
            }
        }
    }

    _validateCheck(check) {
        if (!CHECK_TYPES_ARRAY.includes(check.type)) throw new Error(`Check type "${check.type}" is invalid`);
        if (typeof check.client !== 'object') throw new Error(`Check client must be an object got "${typeof check.client}" instead`);
    }

    _performCheck(check) {
        switch (check.type) {
            case CHECK_TYPES.MONGODB_READ:
                return this._testMongoDbRead(check);
            case CHECK_TYPES.MONGODB_WRITE:
                return this._testMongoDbWrite(check);
            case CHECK_TYPES.REDIS:
                return this._testRedisWrite(check);
            default:
                throw new Error('Unknown check type');
        }
    }

    async _testMongoDbRead({ client }) {
        const response = await client.listCollections().toArray();
        if (!_.isArray(response)) throw new Error(`Got ${typeof response} instead of an array!`);
    }

    async _testMongoDbWrite({ client }) {
        const id = cryptoRandomObjectId();
        const collection = client.collection(this.mongoDbWriteTestCollection);

        // Remove old test items.
        await collection.deleteMany({
            createdAt: {
                $lt: new Date(Date.now() - this.mongoDbWriteTestRemoveOlderThanSecs * 1000),
            },
        });

        // Insert and read some item.
        await collection.insertOne({
            _id: id,
            createdAt: new Date(),
        });
        const retrieved = await collection.findOne({ _id: id });
        if (!retrieved) throw new Error(`Item with ID "${id}" not found!`);
    }

    async _testRedisWrite({ client }) {
        const key = `${this.redisPrefix}:${cryptoRandomObjectId()}`;
        const expected = 'OK';

        // Set some value in Redis and try to read it.
        await client.set(key, expected, 'EX', this.redisTtlSecs);
        const given = await client.get(key);
        if (given !== expected) throw new Error(`Returned value "${given}" is not equal to "${expected}"!`);
    }
}

HealthChecker.CHECK_TYPES = CHECK_TYPES;

export default HealthChecker;
