// Ticket 11723 (25/10/2026), audit verif-11025 : une copie `.avant-` d'un fichier
// suivi est de la litière (« git log suffit »), et ce dépôt est public : GitHub Pages
// sert tout ce qui est commité. Le 25/10/2026, index.html.avant-bascule-20260917
// traînait à la racine, non suivi, avec les trois liens Google Fonts retirés par 11025 ;
// un `git add` maladroit l'aurait publié. Lit le disque et l'index git, aucun réseau.
//
//   node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function copiesAvant(rel = '', trouves = []) {
  for (const e of fs.readdirSync(path.join(DEPOT, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { if (e.name !== '.git' && e.name !== 'node_modules') copiesAvant(r, trouves); }
    else if (e.name.includes('.avant-')) trouves.push(r);
  }
  return trouves;
}

test('aucune copie .avant- dans l arbre de travail du site', () => {
  assert.deepEqual(copiesAvant(), []);
});

test('aucune copie .avant- suivie par git', () => {
  const suivis = execFileSync('git', ['ls-files'], { cwd: DEPOT, encoding: 'utf8' }).split('\n');
  assert.deepEqual(suivis.filter((f) => f.includes('.avant-')), []);
});

test('git ignore une copie .avant- posee plus tard, a la racine comme en sous-dossier', () => {
  for (const f of ['index.html.avant-x-20261025', 'equipe/a.html.avant-y-20261025']) {
    const sortie = execFileSync('git', ['check-ignore', '--no-index', '-v', f], { cwd: DEPOT, encoding: 'utf8' }).trim();
    assert.match(sortie, /^\.gitignore:\d+:/, f);
  }
});
