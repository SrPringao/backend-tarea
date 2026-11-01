// Une los archivos .graphql (un archivo por módulo) y los resolvers (un archivo por módulo)
const fs = require('fs');
const path = require('path');

const typeDefs = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith('.graphql'))
  .sort()
  .map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8'));

const resolversDir = path.join(__dirname, '../resolvers');
const resolvers = fs
  .readdirSync(resolversDir)
  .filter((file) => file.endsWith('.resolvers.js'))
  .sort()
  .map((file) => require(path.join(resolversDir, file)));

module.exports = { typeDefs, resolvers };
