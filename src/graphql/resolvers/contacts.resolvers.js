// Contactos (Sequelize ORM)
const contacts = require('../../services/contacts.service');
const { contacts: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Mutation: {
    mergeContacts: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { sourceId, targetId } = validateArgs(schemas.mergeArgs, args);
      return contacts.merge(user.id, sourceId, targetId);
    },
  },
};
