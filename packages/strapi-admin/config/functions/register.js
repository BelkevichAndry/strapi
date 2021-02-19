'use strict';

const { has } = require('lodash/fp');

const permissionModelUID = 'strapi::permission';

const hasAttribute = attribute => has(`attributes.${attribute}`);
const hasFieldsAttribute = hasAttribute('fields');
const hasPropertiesAttribute = hasAttribute('properties');

const shouldRunMigration = (definition, previousDefinition) => {
  const isAdminPermissionModel = definition.uid === permissionModelUID;
  const targetedFieldsHaveChanged =
    // If the previous definition has fields attr but don't have properties attr
    hasFieldsAttribute(previousDefinition) &&
    !hasPropertiesAttribute(previousDefinition) &&
    // And if the current definition has properties attr but don't have fields attr
    !hasFieldsAttribute(definition) &&
    hasPropertiesAttribute(definition);

  // return isAdminPermissionModel;
  return isAdminPermissionModel && targetedFieldsHaveChanged;
};

const createPermissionsFieldsToPropertiesMigration = () => ({
  async before(options, context) {
    const { model, definition, previousDefinition } = options;
    const willRunMigration = shouldRunMigration(definition, previousDefinition);

    if (!willRunMigration) {
      return;
    }

    let permissions = [];

    switch (model.orm) {
      case 'bookshelf':
        permissions = await model.query();
        break;
      case 'mongoose':
        permissions = await model.find();
        break;
    }

    Object.assign(context, { permissionsFieldsToProperties: { permissions } });
  },

  async after(options, context) {
    const { model, definition, previousDefinition } = options;
    const { permissionsFieldsToProperties = {} } = context;
    const { permissions = [] } = permissionsFieldsToProperties;

    const willRunMigration = shouldRunMigration(definition, previousDefinition);

    if (!willRunMigration || permissions.length === 0) {
      return;
    }

    console.log(permissions);

    if (model.orm === 'bookshelf') {
      // Delete every permission
      await model.where('id', '!=', '0').destroy();

      // todo: will it break relations (incremented ids)?
      // Recreate permission tree from saved ones
      for (const permission of permissions) {
        const { fields, ...rest } = permission;

        await model.save({ ...rest, properties: { fields } });
      }
    }

    if (model.orm === 'mongoose') {
      // Delete every permission
      await model.deleteMany();

      // Recreate permission tree from saved ones
      await model.insertMany(
        permissions.map(permission => {
          const { fields, ...rest } = permission;
          return { ...rest, properties: { fields } };
        })
      );
    }
  },
});

module.exports = () => {
  /**
   * 0. Save data somewhere (fields)
   * 1. Add column (property)
   * 2. Remove column (fields)
   * 3. Copy data (migrate data => fields => { properties: { fields } })
   */
  strapi.db.migrations.register(createPermissionsFieldsToPropertiesMigration());
};
