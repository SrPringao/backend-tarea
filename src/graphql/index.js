// Servidor GraphQL (graphql-yoga) montado dentro de Express en /graphql.
// Protecciones: límites de profundidad, costo, alias, tokens y directivas (graphql-armor),
// errores enmascarados, introspección y GraphiQL desactivados en producción.
const { createYoga, createSchema } = require('graphql-yoga');
const { EnvelopArmor } = require('@escape.tech/graphql-armor');
const { useDisableIntrospection } = require('@graphql-yoga/plugin-disable-introspection');
const config = require('../config/env');
const { buildContext } = require('./context');
const { maskError } = require('./errors');
const { typeDefs, resolvers } = require('./schema');

const armor = new EnvelopArmor({
  maxDepth: { n: 8 },
  costLimit: { maxCost: 5000 },
  maxAliases: { n: 10 },
  maxTokens: { n: 2000 },
  maxDirectives: { n: 20 },
  blockFieldSuggestion: { enabled: config.isProd },
});

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  context: buildContext,
  maskedErrors: { maskError },
  graphiql: config.isProd ? false : { title: 'API Finanzas Personales - GraphQL' },
  landingPage: false,
  plugins: [...armor.protect().plugins, ...(config.isProd ? [useDisableIntrospection()] : [])],
  logging: config.isTest ? false : 'warn',
});

module.exports = { yoga, schema };
