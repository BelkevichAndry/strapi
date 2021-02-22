'use strict';

const { omit, cloneDeep, set, pick, map } = require('lodash/fp');
const { getService } = require('../utils');

/**
 * Create a permission
 * @param {Object} attributes - permission attributes
 */
function createPermission(attributes) {
  return Permission.from(attributes);
}

function toPermission(permission) {
  if (Array.isArray(permission)) {
    return map(Permission.from, permission);
  }

  return Permission.from(permission);
}

/**
 * A Permission instance is a representation of strapi permission object (RBAC)
 *
 * It supercharges the basic object representation by:
 * - Preventing value changes (action, subject)
 * - Adding various validity checks (action, condition)
 * - Limiting the actions of a end-user (conditions, properties) by exposing immutable getters and a limited API
 */
class Permission {
  constructor(action, options = {}) {
    const { subject, properties, conditions, ...rest } = options;

    const { isValidCondition } = getService('condition');

    this._actionId = action;
    this._subject = subject || null;
    this._properties = properties || {};
    console.log(conditions, conditions || [], typeof conditions);
    this._conditions = (conditions || []).filter(isValidCondition);
    this._rest = rest;

    // Define getters for every attributes passed in the options
    Object.entries(rest).forEach(([attribute, value]) => {
      Object.defineProperty(this, attribute, {
        get() {
          return value;
        },
      });
    });
  }

  get action() {
    return this._actionId;
  }

  get subject() {
    return this._subject;
  }

  get properties() {
    return cloneDeep(this._properties);
  }

  get conditions() {
    return cloneDeep(this._conditions);
  }

  get raw() {
    return {
      action: this.action,
      subject: this.subject,
      properties: this.properties,
      conditions: this.conditions,
      // The rest attribute is used to store data such as (but is not restricted to) the id or the role id of a permission.
      // This scenario usually happens when the permission is built using the database object directly.
      ...cloneDeep(this._rest),
    };
  }

  get sanitizedRaw() {
    return pick(['id', 'action', 'subject', 'properties', 'conditions'], this.raw);
  }

  toString() {
    return JSON.stringify(this.raw);
  }

  /**
   * Validate & add a new condition to the permission
   * @param condition
   */
  addCondition(condition) {
    const { isValidCondition } = getService('condition');

    if (isValidCondition(condition)) {
      this._conditions.push(condition);
    }

    return this;
  }

  /**
   * Add or update a property from the permission
   * @param {string} propertyAccessor
   * @param {any} value
   * @return {Permission}
   */
  setProperty(propertyAccessor, value) {
    this._properties = set(propertyAccessor, value, this._properties);
    return this;
  }

  /**
   * Remove a part of the properties from the permission
   * @param {string} propertyAccessor
   * @return {Permission}
   */
  deleteProperty(propertyAccessor) {
    this._properties = omit(propertyAccessor, this._properties);
    return this;
  }

  /**
   * Create a new Permission instance based on the current one
   * Note: This method will perform a deep copy of every internal component
   * @return {Permission}
   */
  clone() {
    return Permission.from(this.raw);
  }

  /**
   * Create a new Permission instance from a raw permission object
   * @param {object} rawPermission
   * @return {Permission}
   */
  static from(rawPermission) {
    const { action, ...options } = rawPermission;
    return new Permission(action, options);
  }
}

module.exports = {
  Permission,
  createPermission,
  toPermission,
};
