// Genera ../backend-tarea.zip con exactamente los archivos del último commit (git archive).
// Así nunca se incluyen .env, node_modules, archivos subidos ni nada que git ignore.
const { execFileSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, '..', 'backend-tarea.zip');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const pending = git('status', '--porcelain');
if (pending) {
  console.error('✖ Hay cambios sin commit; el zip se arma desde el último commit y no los incluiría:');
  console.error(pending.split('\n').map((l) => `  ${l}`).join('\n'));
  process.exit(1);
}

git('archive', '--format=zip', '--prefix=backend-tarea/', '-o', out, 'HEAD');

const files = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n');
const forbidden = files.filter((f) => /(^|\/)\.env$|node_modules\/|^uploads/.test(f));
if (forbidden.length) {
  console.error(`✖ Archivos que no deberían estar en el repositorio: ${forbidden.join(', ')}`);
  process.exit(1);
}
console.log(`✔ Generado ${out} (${files.length} archivos del commit ${git('rev-parse', '--short', 'HEAD')}, sin .env ni node_modules)`);
