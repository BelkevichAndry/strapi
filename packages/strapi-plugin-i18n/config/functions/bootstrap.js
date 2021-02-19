'use strict';

const { capitalize } = require('lodash/fp');
const { getService } = require('../../utils');

const actions = ['create', 'read', 'update', 'delete'].map(uid => ({
  section: 'settings',
  category: 'Internationalization',
  subCategory: 'Locales',
  pluginName: 'i18n',
  displayName: capitalize(uid),
  uid: `locale.${uid}`,
}));

const DEFAULT_LOCALE = {
  code: 'en-US',
};

const conditions = [
  {
    displayName: 'Has Locale Access',
    name: 'has-locale-access',
    plugin: 'i18n',
    handler: (user, options) => {
      const {
        properties: { locales = [] },
      } = options;

      return {
        'locale.code': {
          $in: locales,
        },
      };
    },
  },
];

/**
 *
 * @param {Permission} permission
 */
const i18nPermissionHandler = permission => {
  const {
    subject,
    properties: { locales = [] },
  } = permission.raw;

  // If there is a subject & the subject has i18n enabled & there is some locale restrictions
  if (subject && locales.length > 0) {
    permission.addCondition('plugins::i18n.has-locale-access');
  }
};

module.exports = async () => {
  const { actionProvider, conditionProvider, engine } = strapi.admin.services.permission;

  actionProvider.register(actions);
  conditionProvider.registerMany(conditions);

  engine.registerPermissionsHandler(i18nPermissionHandler);

  const defaultLocale = await getService('locales').getDefaultLocale();
  if (!defaultLocale) {
    await getService('locales').setDefaultLocale(DEFAULT_LOCALE);
  }

  Object.values(strapi.models)
    .filter(model => getService('content-types').isLocalized(model))
    .forEach(model => {
      strapi.db.lifecycles.register({
        model: model.uid,
        async beforeCreate(data) {
          await getService('localizations').assignDefaultLocale(data);
        },
        async afterCreate(entry) {
          await getService('localizations').addLocalizations(entry, { model });
        },
        async afterUpdate(entry) {
          await getService('localizations').updateNonLocalizedFields(entry, { model });
        },
        async afterDelete(entry) {
          await getService('localizations').removeEntryFromRelatedLocalizations(entry, { model });
        },
      });
    });
};
