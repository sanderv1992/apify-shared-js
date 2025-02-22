import ListDictionary from './list_dictionary';

/**
 * The main ListDictionary class.
 */
export default class LruCache {
    constructor(options) {
        if (typeof (options.maxLength) !== 'number') throw new Error('Parameter "maxLength" must be a number.');
        this.listDictionary = new ListDictionary();
        this.maxLength = options.maxLength;
    }

    /**
     * Gets the number of item in the list.
     */
    length() {
        return this.listDictionary.length();
    }

    /**
     * Get item from Cache and move to last position
     *
     * @param {string} key
     */
    get(key) {
        if (typeof (key) !== 'string') throw new Error('Parameter "key" must be a string.');
        const node = this.listDictionary.dictionary[key];
        if (!node) return null;
        // remove item and move it to the end of the list
        this.listDictionary.remove(key);
        this.listDictionary.add(key, node.data);
        return node.data;
    }

    /**
     * Add new item to cache, remove least used item if length exceeds maxLength
     *
     * @param {string} key
     * @param {*} value
     */
    add(key, value) {
        const added = this.listDictionary.add(key, value);
        if (!added) return false;
        if (this.length() > this.maxLength) {
            this.listDictionary.removeFirst();
        }
        return true;
    }

    /**
     * Remove item with key
     *
     * @param {string} key
     */
    remove(key) {
        return this.listDictionary.remove(key);
    }

    /**
     * Clear cache
     */
    clear() {
        return this.listDictionary.clear();
    }
}
