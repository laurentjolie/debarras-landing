// Ticket 11198 (24/10/2026), suite de l'aperçu 10710 (audit UI 10512, suggestion 2) :
// le haut de site porte l'accroche, le bouton d'accès, une preuve chiffrée datée et
// l'écran « Ce qu'on te doit » de l'application, à deux colonnes sur ordinateur et
// empilés sur téléphone. Ticket 13149 (28/10/2026) : cet écran est retiré, son image
// promettait un reversement (« à te virer aujourd'hui », D-2026-10-26-a) ; le haut de
// site ne garde que la colonne texte. Lit le VRAI index.html, aucun réseau.
//
//   node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');

function bloc() {
  const debut = HTML.indexOf('<header class="ouverture ouverture--preuve">');
  assert.ok(debut >= 0, 'header.ouverture.ouverture--preuve introuvable');
  return HTML.slice(debut, HTML.indexOf('</header>', debut));
}

test('11198 : un seul haut de site, et c\'est le nouveau', () => {
  assert.equal(HTML.split('<header class="ouverture').length - 1, 1);
  assert.ok(!HTML.includes('<header class="ouverture">'), 'l\'ancien header est encore là');
});

test('11198 : accroche et bouton d\'accès, dans cet ordre, dans la colonne texte', () => {
  const b = bloc();
  const texte = b.slice(b.indexOf('<div class="texte">'));
  const h1 = texte.indexOf('<h1 class="titrage">Tes affaires se vendent <em>pendant que tu fais autre chose.</em></h1>');
  const bouton = texte.indexOf('<a class="bouton bouton--large" href="#acces">Demander un accès</a>');
  const preuve = texte.indexOf('<p class="preuve">');
  assert.ok(h1 >= 0 && bouton > h1 && preuve > bouton, 'titre, puis bouton, puis preuve');
  assert.match(texte, /Une photo suffit pour commencer\./);
});

test('11198 : la preuve est chiffrée et datée', () => {
  const b = bloc();
  assert.match(b, /<b>\d+ objets vendus depuis le 1er septembre<\/b>/);
  assert.match(b, /vendus en \d+ jours en médiane après leur validation/);
  assert.match(b, /commission 5 %, rien si ça ne part pas\./);
  assert.match(b, /<small>Chiffres relevés le \d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) 20\d\d\.<\/small>/);
});

test('13149 : le haut de site ne montre plus d\'écran de reversement, ni sa colonne', () => {
  const b = bloc();
  assert.ok(!b.includes('<figure'), 'une figure est revenue dans le haut de site');
  assert.ok(!b.includes('<img'), 'une image est revenue dans le haut de site');
  assert.ok(!/\.ouverture--preuve \{ grid-template-columns/.test(HTML), 'colonne vide de l\'ancien écran');
});
