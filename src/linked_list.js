/* eslint-disable max-classes-per-file */

/*!
 * This module defines the LinkedList class, which represents a doubly-linked list data structure.
 *
 * Author: Jan Curn (jan@apify.com)
 * Copyright(c) 2014 Apify. All rights reserved.
 *
 */

/**
 * A helper function to determine whether two data objects are equal.
 * The function attempts to do so using data1's function 'equal(data)' if there is one,
 * otherwise it uses '==' operator.
 */
const dataEqual = (data1, data2) => {
    if (data1 === null) return data2 === null;
    if (data1.equals) return data1.equals(data2);

    return data1 === data2;
};

class LinkedListNode {
    constructor(data) {
        this.prev = null;
        this.next = null;
        this.data = data;
    }
}

/**
 * A class representing a doubly-linked list.
 */
export default class LinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }

    /**
      * Appends a new node with specific data to the end of the linked list.
      *
      * @param {*} data
      * @param {boolean} [toFirstPosition]
      */
    add(data, toFirstPosition) {
        const node = new LinkedListNode(data);
        this.addNode(node, toFirstPosition);

        return node;
    }

    /**
     * Appends a new node to the end of the linked list or the beginning if firstPosition is true-ish.
     *
     * @param {LinkedListNode} node
     * @param {boolean} [toFirstPosition]
     */
    addNode(node, toFirstPosition) {
        if (typeof (node) !== 'object' || node === null) throw new Error('Parameter "node" must be an object');
        if (node.prev || node.next) throw new Error('New node is still included in some linked list');

        // ensure they are null and not undefined!
        node.prev = null;
        node.next = null;

        if (this.length === 0) {
            this.tail = node;
            this.head = node;
        } else if (toFirstPosition) {
            node.next = this.head;
            this.head.prev = node;
            this.head = node;
        } else { // last position
            node.prev = this.tail;
            this.tail.next = node;
            this.tail = node;
        }
        this.length++;
    }

    /**
     * Finds a first node that holds a specific data object. See 'dataEqual' function for a description
     * how the object equality is tested. Function returns null if the data cannot be found.
     *
     * @param {*} data
     */
    find(data) {
        for (let node = this.head; node !== null; node = node.next) {
            if (dataEqual(node.data, data)) return node;
        }

        return null;
    }

    /**
     * @param {LinkedListNode} node
     */
    removeNode(node) {
        if (typeof (node) !== 'object' || node === null) throw new Error('Parameter "node" must be an object');

        if (node.prev !== null) {
            // some predecessor
            if (node.next !== null) {
                // some successor
                node.prev.next = node.next;
                node.next.prev = node.prev;
                node.prev = null;
                node.next = null;
            } else {
                // no successor
                this.tail = node.prev;
                node.prev.next = null;
                node.prev = null;
            }
        } else if (node.next !== null) {
            // some successor
            this.head = node.next;
            node.next.prev = null;
            node.next = null;
        } else {
            // no successor
            this.head = null;
            this.tail = null;
            node.next = null; // TODO: not needed???
            node.prev = null;
        }

        this.length--;
    }

    /**
     * Removes the first item from the list. The function
     * returns the item object or null if the list is empty.
     */
    removeFirst() {
        const { head } = this;
        if (!head) return null;

        this.removeNode(head);

        return head.data;
    }
}
