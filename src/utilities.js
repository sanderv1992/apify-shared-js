/*!
 * This module contains various server utility and helper functions.
 * Note that it automatically exports functions from utilities.client.js
 *
 * Author: Jan Curn (jan@apify.com)
 * Copyright(c) 2015 Apify. All rights reserved.
 *
 */

const _ = require('underscore');
const crypto = require('crypto');
const Promise = require('bluebird');
const request = require('request');
const utilsClient = require('./utilities.client');
const log = require('./log');
const consts = require('./consts');

const { LoggerJson, LEVELS } = log;

_.extend(exports, utilsClient);

/**
 * Generates a random cryptographically strong string consisting of 17 alphanumeric characters.
 * This string is similar to MongoDB ObjectIds generated by Meteor.
 *
 * @return String
 */
exports.cryptoRandomObjectId = function cryptoRandomObjectId(length) {
    length = length || 17;

    const chars = 'abcdefghijklmnopqrstuvwxyzABCEDFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(length);
    let str = '';
    // eslint-disable-next-line
    for (let i = bytes.length - 1; i >= 0; i--) { str += chars[(bytes[i] | 0) % chars.length]; }
    return str;
};

/**
 * Returns a random integer between 0 and max (excluded, unless it is also 0).
 * @param maxExcluded
 * @returns {number}
 */
exports.getRandomInt = function (maxExcluded) {
    maxExcluded = Math.floor(maxExcluded);
    return Math.floor(Math.random() * maxExcluded);
};

/**
 * If 'date' is a String, this function converts and returns it as a Date object.
 * Otherwise, the function returns the original 'date' argument.
 * This function is useful to convert dates transfered via JSON which doesn't natively support dates.
 */
exports.parseDateFromJson = function (date) {
    if (typeof (date) === 'string') { return new Date(Date.parse(date)); }
    return date;
};

/**
 * Returns a Promise object that will wait a specific number of milliseconds.
 * @param millis Time to wait. If the value is not larger than zero, the promise resolves immediatelly.
 * @returns Promise
 */
exports.delayPromise = function (millis) {
    return new Promise(((resolve) => {
        if (millis > 0) {
            setTimeout(() => resolve(), millis);
        } else {
            resolve();
        }
    }));
};

/**
 * Creates a promise that immediately resolves with a specific result.
 * This is used as workaround if the first operation in chain uses a different Promise library that doesn't support nodeify(),
 * or to ensure exceptions are passed through the Promise chain rather than simply thrown
 * or simply to structure the promise chain in a nicer way.
 * @returns {*}
 */
exports.newPromise = function (result) {
    return new Promise(((resolve) => {
        resolve(result);
    }));
};

/**
 * Removes an element from an array.
 * @param array
 * @param element
 */
exports.removeFromArray = function (array, element) {
    const index = array.indexOf(element);
    if (index >= 0) {
        array.splice(index, 1);
        return true;
    }
    return false;
};

/**
 * A default route for HTTP 404 error page for API endpoints.
 * @param req
 * @param res
 */
exports.http404Route = function (req, res) {
    res.status(404);
    res.send('Page not found');
};

/**
 * Default error handler of Express API endpoints.
 * @param err
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
exports.expressErrorHandler = function (err, req, res, next) {
    log.warning('Client HTTP request failed', { url: req.url, errMsg: err.message });
    if (res.headersSent) { return next(err); }
    res.status(505);
    res.send('Internal server error');
};

/**
 * Similar to setInterval() but with two important differences:
 * First, it assumes the function is asynchronous and only schedules its next invocation AFTER the asynchronous function finished.
 * Second, it invokes the function immediately.
 * @param func Asynchronous function to be periodically executed. It must take a single argument with a callback that
 * the function must invoke after it's done.
 * @param delay The number of milliseconds to wait to next invocation of the function.
 * @returns Object that can be passed to betterClearInterval()
 */
exports.betterSetInterval = function (func, delay) {
    let callback;
    let timeoutId;
    let isRunning = true;
    const funcWrapper = function () {
        func(callback);
    };
    callback = function () {
        if (isRunning) timeoutId = setTimeout(funcWrapper, delay);
    };
    funcWrapper();
    return {
        // eslint-disable-next-line no-underscore-dangle
        _betterClearInterval() {
            isRunning = false;
            clearTimeout(timeoutId);
        },
    };
};

exports.betterClearInterval = function (intervalID) {
    // eslint-disable-next-line no-underscore-dangle
    if (intervalID && intervalID._betterClearInterval) {
        try {
            // eslint-disable-next-line no-underscore-dangle
            intervalID._betterClearInterval();
        } catch (e) {
            log.exception(e, '_betterClearInterval() threw an exception!?');
        }
    }
};

/**
 * Escapes a string so that it can be used in regular expression (e.g. converts "myfile.*" to "myfile\\.\\*").
 * @param string
 */
exports.escapeRegExp = function (str) {
    // code taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * String left pad
 */
exports.leftpad = function (str, len, ch) {
    // code inspired by https://www.theregister.co.uk/2016/03/23/npm_left_pad_chaos/
    str = String(str);

    let i = -1;

    if (!ch && ch !== 0) ch = ' ';

    len -= str.length;

    while (++i < len) {
        str = ch + str;
    }

    return str;
};

/**
 * Computes weighted average of 2 values.
 */
exports.weightedAverage = function (val1, weight1, val2, weight2) {
    return (val1 * weight1 + val2 * weight2) / (weight1 + weight2);
};

/**
 * Promised version of request() library.
 * @param opts Options object for request() function.
 * @param failOnHttpError If true-ish, the function rejects the promise
 * if HTTP status is in the range 4XX or 5XX.
 * @return
 */
exports.requestPromised = function (opts, failOnHttpError) {
    // TODO: Add unit test for this !!!
    return new Promise(((resolve, reject) => {
        request(opts, (error, response, body) => {
            if (error) return reject(error);
            if (failOnHttpError && response.statusCode >= 400 && response.statusCode <= 599) {
                const err = new Error(`Received HTTP error response status ${response.statusCode}`);
                err.statusCode = response.statusCode;
                err.body = body;
                return reject(err);
            }
            resolve({ body, response, statusCode: response.statusCode });
        });
    }));
};

/**
 * List of forbidden usernames. Note that usernames can be used as apify.com/username,
 * so we need to prohibit any username that might be part of our website or confusing in anyway.
 */
const FORBIDDEN_USERNAMES_REGEXPS = [
    // Meteor app routes
    'page-not-found', 'docs', 'terms-of-use', 'about', 'pricing', 'privacy-policy', 'customers',
    'request-form', 'request-solution', 'release-notes', 'jobs', 'api-reference', 'video-tutorials',
    'acts', 'key-value-stores', 'schedules', 'account', 'sign-up', 'sign-in-discourse', 'admin',
    'documentation', 'change-password', 'enroll-account', 'forgot-password', 'reset-password',
    'sign-in', 'verify-email', 'live-status', 'browser-info', 'webhooks', 'health-check', 'api',
    'change-log', 'dashboard', 'community', 'crawlers', 'ext',

    // Various strings
    'admin', 'administration', 'crawler', 'act', 'library', 'lib', 'apifier', 'team',
    'contact', 'doc', 'documentation', 'for-business', 'for-developers', 'developers', 'business',
    'integrations', 'job', 'setting', 'settings', 'privacy', 'policy', 'assets', 'help',
    'config', 'configuration', 'terms', 'hiring', 'hire', 'status', 'status-page', 'solutions',
    'support', 'market', 'marketplace', 'download', 'downloads', 'username', 'users', 'user',
    'login', 'logout', 'signin', 'sign', 'signup', 'sign-out', 'signout', 'plugins', 'plug-ins',
    'reset', 'password', 'passwords', 'square', 'profile-photos', 'profiles', 'true', 'false',
    'js', 'css', 'img', 'images', 'image', 'partials', 'fonts', 'font', 'dynamic_templates',
    'app', 'schedules', 'community', 'storage', 'storages', 'account', 'node_modules', 'bower_components',
    'video', 'knowledgebase', 'forum', 'customers', 'blog', 'health-check', 'health', 'anim',
    'forum_topics.json', 'forum_categories.json', 'me', 'you', 'him', 'she', 'it', 'external',
    'actor', 'crawler', 'scheduler', 'api', 'sdk', 'puppeteer', 'webdriver',
    'selenium', '(selenium.*webdriver)', 'undefined', 'page-analyzer', 'wp-login.php',
    'welcome.action', 'echo', 'proxy', 'super-proxy', 'gdpr', 'case-studies', 'use-cases', 'how-to',
    'kb', 'cookies', 'cookie-policy', 'cookies-policy', 'powered-by', 'run', 'runs', 'actor', 'actors',
    'act', 'acts', 'success-stories', 'roadmap', 'join-marketplace', 'presskit', 'press-kit', 'covid-19',
    'covid', 'covid19', 'matfyz',

    // Special files
    'index', 'index\\.html', '(favicon\\.[a-z]+)', 'BingSiteAuth.xml', '(google.+\\.html)', 'robots\\.txt',
    '(sitemap\\.[a-z]+)', '(apple-touch-icon.*)',

    // All hidden files
    '(\\..*)',

    // File starting with xxx-
    '(xxx-.*)',

    // Strings not starting with letter or number
    '([^0-9a-z].*)',

    // Strings not ending with letter or number
    '(.*[^0-9a-z])',

    // Strings where there's more than one underscore, comma or dash in row
    '(.*[_.\\-]{2}.*)',

    // Reserved usernames from https://github.com/shouldbee/reserved-usernames/blob/master/reserved-usernames.json
    '0', 'about', 'access', 'account', 'accounts', 'activate', 'activities', 'activity', 'ad', 'add',
    'address', 'adm', 'admin', 'administration', 'administrator', 'ads', 'adult', 'advertising',
    'affiliate', 'affiliates', 'ajax', 'all', 'alpha', 'analysis', 'analytics', 'android', 'anon',
    'anonymous', 'api', 'app', 'apps', 'archive', 'archives', 'article', 'asct', 'asset', 'atom',
    'auth', 'authentication', 'avatar', 'backup', 'balancer-manager', 'banner', 'banners', 'beta',
    'billing', 'bin', 'blog', 'blogs', 'board', 'book', 'bookmark', 'bot', 'bots', 'bug', 'business',
    'cache', 'cadastro', 'calendar', 'call', 'campaign', 'cancel', 'captcha', 'career', 'careers',
    'cart', 'categories', 'category', 'cgi', 'cgi-bin', 'changelog', 'chat', 'check', 'checking',
    'checkout', 'client', 'cliente', 'clients', 'code', 'codereview', 'comercial', 'comment',
    'comments', 'communities', 'community', 'company', 'compare', 'compras', 'config', 'configuration',
    'connect', 'contact', 'contact-us', 'contact_us', 'contactus', 'contest', 'contribute', 'corp',
    'create', 'css', 'dashboard', 'data', 'db', 'default', 'delete', 'demo', 'design', 'designer',
    'destroy', 'dev', 'devel', 'developer', 'developers', 'diagram', 'diary', 'dict', 'dictionary',
    'die', 'dir', 'direct_messages', 'directory', 'dist', 'doc', 'docs', 'documentation', 'domain',
    'download', 'downloads', 'ecommerce', 'edit', 'editor', 'edu', 'education', 'email', 'employment',
    'empty', 'end', 'enterprise', 'entries', 'entry', 'error', 'errors', 'eval', 'event', 'exit',
    'explore', 'facebook', 'faq', 'favorite', 'favorites', 'feature', 'features', 'feed', 'feedback',
    'feeds', 'file', 'files', 'first', 'flash', 'fleet', 'fleets', 'flog', 'follow', 'followers',
    'following', 'forgot', 'form', 'forum', 'forums', 'founder', 'free', 'friend', 'friends', 'ftp',
    'gadget', 'gadgets', 'game', 'games', 'get', 'gift', 'gifts', 'gist', 'github', 'graph', 'group',
    'groups', 'guest', 'guests', 'help', 'home', 'homepage', 'host', 'hosting', 'hostmaster',
    'hostname', 'howto', 'hpg', 'html', 'http', 'httpd', 'https', 'i', 'iamges', 'icon', 'icons',
    'id', 'idea', 'ideas', 'image', 'images', 'imap', 'img', 'index', 'indice', 'info', 'information',
    'inquiry', 'instagram', 'intranet', 'invitations', 'invite', 'ipad', 'iphone', 'irc', 'is',
    'issue', 'issues', 'it', 'item', 'items', 'java', 'javascript', 'job', 'jobs', 'join', 'js',
    'json', 'jump', 'knowledgebase', 'language', 'languages', 'last', 'ldap-status', 'legal', 'license',
    'link', 'links', 'linux', 'list', 'lists', 'log', 'log-in', 'log-out', 'log_in', 'log_out',
    'login', 'logout', 'logs', 'm', 'mac', 'mail', 'mail1', 'mail2', 'mail3', 'mail4', 'mail5',
    'mailer', 'mailing', 'maintenance', 'manager', 'manual', 'map', 'maps', 'marketing', 'master',
    'me', 'media', 'member', 'members', 'message', 'messages', 'messenger', 'microblog', 'microblogs',
    'mine', 'mis', 'mob', 'mobile', 'movie', 'movies', 'mp3', 'msg', 'msn', 'music', 'musicas', 'mx',
    'my', 'mysql', 'name', 'named', 'nan', 'navi', 'navigation', 'net', 'network', 'new', 'news',
    'newsletter', 'nick', 'nickname', 'notes', 'noticias', 'notification', 'notifications', 'notify',
    'ns', 'ns1', 'ns10', 'ns2', 'ns3', 'ns4', 'ns5', 'ns6', 'ns7', 'ns8', 'ns9', 'null', 'oauth',
    'oauth_clients', 'offer', 'offers', 'official', 'old', 'online', 'openid', 'operator', 'order',
    'orders', 'organization', 'organizations', 'overview', 'owner', 'owners', 'page', 'pager',
    'pages', 'panel', 'password', 'payment', 'perl', 'phone', 'photo', 'photoalbum', 'photos', 'php',
    'phpmyadmin', 'phppgadmin', 'phpredisadmin', 'pic', 'pics', 'ping', 'plan', 'plans', 'plugin',
    'plugins', 'policy', 'pop', 'pop3', 'popular', 'portal', 'post', 'postfix', 'postmaster', 'posts',
    'pr', 'premium', 'press', 'price', 'pricing', 'privacy', 'privacy-policy', 'privacy_policy',
    'privacypolicy', 'private', 'product', 'products', 'profile', 'project', 'projects', 'promo',
    'pub', 'public', 'purpose', 'put', 'python', 'query', 'random', 'ranking', 'read', 'readme',
    'recent', 'recruit', 'recruitment', 'register', 'registration', 'release', 'remove', 'replies',
    'report', 'reports', 'repositories', 'repository', 'req', 'request', 'requests', 'reset', 'roc',
    'root', 'rss', 'ruby', 'rule', 'sag', 'sale', 'sales', 'sample', 'samples', 'save', 'school',
    'script', 'scripts', 'search', 'secure', 'security', 'self', 'send', 'server', 'server-info',
    'server-status', 'service', 'services', 'session', 'sessions', 'setting', 'settings', 'setup',
    'share', 'shop', 'show', 'sign-in', 'sign-up', 'sign_in', 'sign_up', 'signin', 'signout', 'signup',
    'site', 'sitemap', 'sites', 'smartphone', 'smtp', 'soporte', 'source', 'spec', 'special', 'sql',
    'src', 'ssh', 'ssl', 'ssladmin', 'ssladministrator', 'sslwebmaster', 'staff', 'stage', 'staging',
    'start', 'stat', 'state', 'static', 'stats', 'status', 'store', 'stores', 'stories', 'style',
    'styleguide', 'stylesheet', 'stylesheets', 'subdomain', 'subscribe', 'subscriptions', 'suporte',
    'support', 'svn', 'swf', 'sys', 'sysadmin', 'sysadministrator', 'system', 'tablet', 'tablets',
    'tag', 'talk', 'task', 'tasks', 'team', 'teams', 'tech', 'telnet', 'term', 'terms',
    'terms-of-service', 'terms_of_service', 'termsofservice', 'test', 'test1', 'test2', 'test3',
    'teste', 'testing', 'tests', 'theme', 'themes', 'thread', 'threads', 'tmp', 'todo', 'tool',
    'tools', 'top', 'topic', 'topics', 'tos', 'tour', 'translations', 'trends', 'tutorial', 'tux',
    'tv', 'twitter', 'undef', 'unfollow', 'unsubscribe', 'update', 'upload', 'uploads', 'url',
    'usage', 'user', 'username', 'users', 'usuario', 'vendas', 'ver', 'version', 'video', 'videos',
    'visitor', 'watch', 'weather', 'web', 'webhook', 'webhooks', 'webmail', 'webmaster', 'website',
    'websites', 'welcome', 'widget', 'widgets', 'wiki', 'win', 'windows', 'word', 'work', 'works',
    'workshop', 'ww', 'wws', 'www', 'www1', 'www2', 'www3', 'www4', 'www5', 'www6', 'www7', 'wwws',
    'wwww', 'xfn', 'xml', 'xmpp', 'xpg', 'xxx', 'yaml', 'year', 'yml', 'you', 'yourdomain', 'yourname',
    'yoursite', 'yourusername',
];

// Regex matching forbidden usernames.
const FORBIDDEN_REGEXP = new RegExp(`^(${consts.ANONYMOUS_USERNAME}|${FORBIDDEN_USERNAMES_REGEXPS.join('|')})$`, 'i');

/**
 * Checks whether username is listed in FORBIDDEN_USERNAMES
 * or matches any root route path.
 */
exports.isForbiddenUsername = function (username) {
    return !!username.match(FORBIDDEN_REGEXP);
};

/**
 * Executes array of promises in sequence and then returns array where Nth item is result of Nth promise.
 */
exports.sequentializePromises = (promises) => {
    const results = [];

    if (!promises.length) return Promise.resolve([]);

    const firstPromise = promises.shift();

    return promises
        .reduce((prev, next) => {
            return prev.then((data) => {
                results.push(data);

                return next.then ? next : next();
            });
        }, firstPromise.then ? firstPromise : firstPromise())
        .then((data) => {
            results.push(data);

            return results;
        });
};

/**
 * Helper function for validation if parameter is an instance of given prototype or multiple prototypes.
 */
exports.checkParamPrototypeOrThrow = (paramVal, paramName, prototypes, prototypeName, isOptional = false) => {
    if (isOptional && (paramVal === undefined || paramVal === null)) return;

    const hasCorrectPrototype = prototypes instanceof Array
        ? _.some(prototypes, prototype => paramVal instanceof prototype)
        : paramVal instanceof prototypes;

    if (!hasCorrectPrototype) throw new Error(`Parameter "${paramName}" must be an instance of ${prototypeName}`);
};

/**
 * Starts listening at a port specified in the constructor.
 * Unfortunately server.listen() is not a normal function that fails on error, so we need this trickery.
 * Returns a function that calls `server.listen(port)` and resolves once server starts listening.
 *
 * Usage: `promisifyServerListen(server)(1234)`;
 *
 * @param {Number} port
 * @return {Function}
 */
exports.promisifyServerListen = (server) => {
    return (port) => {
        return new Promise((resolve, reject) => {
            const onError = (err) => {
                removeListeners();
                reject(err);
            };
            const onListening = () => {
                removeListeners();
                resolve();
            };
            const removeListeners = () => {
                server.removeListener('error', onError);
                server.removeListener('listening', onListening);
            };

            server.on('error', onError);
            server.on('listening', onListening);
            server.listen(port);
        });
    };
};

exports.configureLogger = (givenLog, isProduction) => {
    if (isProduction) {
        givenLog.setOptions({
            level: LEVELS.INFO,
            logger: new LoggerJson(),
        });
    } else {
        givenLog.setOptions({ level: LEVELS.DEBUG });
    }
};
