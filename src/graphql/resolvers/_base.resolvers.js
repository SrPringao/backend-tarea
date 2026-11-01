const { GraphQLScalarType, Kind } = require('graphql');

// Serializa Date (o texto de fecha) siempre como ISO 8601
const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value) => (value instanceof Date ? value : new Date(value)).toISOString(),
  parseValue: (value) => new Date(value),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

module.exports = {
  DateTime,
  Query: { ping: () => 'pong' },
  Mutation: { ping: () => 'pong' },
};
