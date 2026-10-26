// Ticket 11025 (25/10/2026), audit sécurité 10724 suggestion 22, carte 11283 close
// sur l'issue 1 (police système) : aucune page du site ne charge de police chez un
// tiers, l'adresse IP du visiteur ne part plus chez Google. Lit les VRAIS .html du
// dépôt, aucun réseau.
//
//   node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGES = fs.readdirSync(DEPOT).filter((f) => f.endsWith('.html'));

const HOTES_DE_POLICE = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'fonts.bunny.net',
  'fast.fonts.net',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

test('11025 : les pages publiques sont bien lues (index.html et equipe.html)', () => {
  assert.ok(PAGES.includes('index.html'), 'index.html introuvable');
  assert.ok(PAGES.includes('equipe.html'), 'equipe.html introuvable');
});

test('11025 : aucun hôte tiers de police dans les pages', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(DEPOT, page), 'utf8');
    for (const hote of HOTES_DE_POLICE) {
      assert.ok(!html.includes(hote), `${page} appelle encore ${hote}`);
    }
  }
});

test('11025 : aucune feuille de style ni preconnect vers un autre domaine', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(DEPOT, page), 'utf8');
    const liens = html.match(/<link\b[^>]*>/g) || [];
    for (const lien of liens) {
      if (!/rel="(stylesheet|preconnect|preload|dns-prefetch)"/.test(lien)) continue;
      const href = (lien.match(/href="([^"]*)"/) || [])[1] || '';
      assert.ok(!/^(https?:)?\/\//.test(href), `${page} : ${lien}`);
    }
    assert.ok(!/@import\s+url\(\s*["']?(https?:)?\/\//.test(html), `${page} : @import distant`);
  }
});

// Ticket 12059 (26/10/2026), suite de 11025 : sans la feuille Google, le nom
// « Bricolage Grotesque » en tête d'une pile ne chargeait rien chez la plupart des
// visiteurs, mais donnait un autre rendu à qui l'a installée et laissait croire au
// lecteur du code que la police était servie. Décision polices-landing-11283 :
// police système, donc le nom ne figure plus dans aucune pile.
test('12059 : aucune pile font-family ne nomme Bricolage Grotesque', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(DEPOT, page), 'utf8');
    const piles = html.match(/font-family\s*:[^;}]*/g) || [];
    for (const pile of piles) {
      assert.ok(!/bricolage/i.test(pile), `${page} : ${pile.trim()}`);
    }
    assert.ok(!/bricolage/i.test(html), `${page} nomme encore Bricolage`);
  }
});
