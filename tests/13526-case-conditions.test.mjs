// Ticket 13526 (29/10/2026) : la case des conditions du formulaire d'acces.
// Vrai script de index.html dans un DOM minimal, fetch injecte (aucun reseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];

test('13526.L1 la case existe, non cochee par defaut, avec les deux liens', () => {
  const bloc = HTML.match(/<div class="champ champ-conditions"[\s\S]*?<\/div>/)[0];
  assert.match(bloc, /<input id="f-conditions" name="conditions" type="checkbox" required>/);
  assert.doesNotMatch(bloc, /checked/);
  assert.match(bloc, /J'ai lu et j'accepte les/);
  assert.match(bloc, /href="https:\/\/app\.debarras\.app\/conditions"/);
  assert.match(bloc, /href="https:\/\/app\.debarras\.app\/confidentialite"/);
});

async function contexte(cochee) {
  const el = (id) => ({ id, _c: new Set(), style: {}, textContent: '', listeners: {}, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, querySelector() { return null; }, appendChild() {}, scrollIntoView() {},
    classList: { add() {}, remove() {}, toggle(c, f) { el.marques = el.marques || {}; el.marques[id + c] = f; }, contains() { return false; } } });
  const els = new Map(['repli', 'repli-texte', 'repli-motif', 'merci', 'controle', 'controle-titre', 'btn-envoyer', 'btn-copier', 'bloc-provenance-qui', 'form-acces'].map(i => [i, el(i)]));
  const form = els.get('form-acces');
  const marques = [];
  form.querySelector = (sel) => { const m = sel.match(/data-champ="(\w+)"/); return m ? { classList: { toggle(c, f) { marques.push([m[1], f]); } }, querySelector() { return null; }, appendChild() {} } : null; };
  form.elements = { email: { value: 'jo@exemple.fr' }, conditions: { checked: cochee } };
  for (const n of ['prenom', 'volume', 'quoi', 'provenance', 'provenance_qui', 'champ_b7']) form.elements[n] = { value: '' };
  const appels = [];
  const sandbox = { document: { body: el('body'), getElementById: (i) => els.get(i) || null, createElement: () => el('tmp') },
    window: { location: { hash: '', search: '' }, addEventListener() {}, scrollTo() {}, AbortController, get fetch() { return sandbox.fetch; } },
    navigator: {}, console, setTimeout, clearTimeout, AbortController,
    fetch(url, opts) { if (/conditions-version/.test(url)) return Promise.resolve({ ok: true, json: async () => ({ version: '2' }) }); appels.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }); } };
  vm.runInContext(SCRIPT, vm.createContext(sandbox));
  await new Promise(r => setImmediate(r));
  form.listeners.submit[0]({ preventDefault() {} });
  return { appels, marques };
}

test('13526.L2 sans la case, rien ne part et le champ est marque invalide', async () => {
  const c = await contexte(false);
  await new Promise(r => setImmediate(r));
  assert.equal(c.appels.length, 0);
  assert.ok(c.marques.some(([n, f]) => n === 'conditions' && f === true));
});

test('13526.L3 avec la case, la demande part avec conditions_acceptees: true', async () => {
  const c = await contexte(true);
  await new Promise(r => setImmediate(r));
  assert.equal(c.appels.length, 1);
  assert.equal(JSON.parse(c.appels[0].opts.body).conditions_acceptees, true);
});

test('13540.L1 la demande renvoie la version lue a l\'ouverture de la page', async () => {
  const c = await contexte(true);
  await new Promise(r => setImmediate(r));
  assert.equal(JSON.parse(c.appels[0].opts.body).conditions_version, '2');
});
