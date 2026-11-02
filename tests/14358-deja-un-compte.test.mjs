// Ticket 14358 (02/11/2026) : un déposant qui tape debarras.app pour se connecter
// depuis son ordinateur ne trouvait que la demande d'accès (appel avec Blaise, 02/11).
// Un lien « J'ai déjà un compte » vers https://app.debarras.app, en haut à droite des
// deux vues et sous le formulaire. Simple lien : aucun script, la mesure des visites
// (ping ?d=, ouverture du formulaire) n'est pas touchée. Lit le VRAI index.html.
//
//   node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');
const LIEN = /<a class="[^"]*\blien-compte\b[^"]*" href="https:\/\/app\.debarras\.app\/?">J'ai déjà un compte<\/a>/g;

function vue(id) {
  const debut = HTML.indexOf(`<div id="${id}">`);
  assert.ok(debut >= 0, `#${id} introuvable`);
  const fin = id === 'vue-landing' ? HTML.indexOf('<div id="vue-acces">') : HTML.indexOf('<script', debut);
  return HTML.slice(debut, fin);
}

function barre(bloc) {
  const debut = bloc.indexOf('<nav class="barre">');
  assert.ok(debut >= 0, 'barre introuvable');
  return bloc.slice(debut, bloc.indexOf('</nav>', debut));
}

test('14358.1 : la barre de la page porte « J\'ai déjà un compte » vers l\'app', () => {
  assert.equal((barre(vue('vue-landing')).match(LIEN) || []).length, 1);
});

test('14358.2 : la barre du formulaire et le dessous du formulaire le portent aussi', () => {
  const acces = vue('vue-acces');
  assert.equal((barre(acces).match(LIEN) || []).length, 1, 'barre du formulaire');
  const finForm = acces.indexOf('</form>');
  const merci = acces.indexOf('<div class="merci" id="merci">');
  assert.ok(finForm >= 0 && merci > finForm);
  assert.equal((acces.slice(finForm, merci).match(LIEN) || []).length, 1, 'sous le formulaire');
});

test('14358.3 : le lien n\'est jamais masqué sur téléphone (seul « L\'équipe » cède sa place)', () => {
  const css = HTML.slice(0, HTML.indexOf('</style>'));
  assert.ok(!/\.lien-compte\s*\{[^}]*display:\s*none/.test(css), 'lien-compte masqué');
  for (const m of css.matchAll(/@media[^{]*\{([^@]*?)\}\s*\}/g)) {
    assert.ok(!/\.lien-nav\s*\{\s*display:\s*none/.test(m[1]) || /\.lien-nav:not\(\.lien-compte\)/.test(m[1]),
      'une règle masque .lien-nav, donc le lien de compte : ' + m[0]);
  }
});
