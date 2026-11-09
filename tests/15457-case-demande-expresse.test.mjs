// Ticket 15457 (09/11/2026) : la case de demande expresse (CGU 1.1 art. 9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];

test('15457.L1 la case existe, facultative, non precochee, texte exact, cible 40 px', () => {
  const bloc = HTML.match(/<div class="champ champ-conditions" data-champ="execution_anticipee">[\s\S]*?<\/label>/)[0];
  const input = bloc.match(/<input[^>]*>/)[0];
  assert.match(input, /name="execution_anticipee"/);
  assert.match(input, /type="checkbox"/);
  assert.doesNotMatch(input, /required|checked/);
  assert.ok(bloc.includes('Je demande que mes objets puissent être publiés avant la fin de mon délai de rétractation'));
  assert.match(bloc, /attend la fin des 14 jours/);
  assert.match(HTML, /\.champ-conditions label \{[^}]*min-height: 44px/);
});

async function contexte(expresse) {
  const el = (id) => ({ id, style: {}, textContent: '', listeners: {}, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, querySelector() { return null; }, appendChild() {}, scrollIntoView() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
  const els = new Map(['repli', 'repli-texte', 'repli-motif', 'merci', 'controle', 'controle-titre', 'btn-envoyer', 'btn-copier', 'bloc-provenance-qui', 'form-acces'].map(i => [i, el(i)]));
  const form = els.get('form-acces');
  form.querySelector = () => ({ classList: { toggle() {} }, querySelector() { return null; }, appendChild() {} });
  form.elements = { email: { value: 'jo@exemple.fr' }, conditions: { checked: true } };
  if (expresse !== undefined) form.elements.execution_anticipee = { checked: expresse };
  for (const n of ['prenom', 'volume', 'quoi', 'provenance', 'provenance_qui', 'champ_b7']) form.elements[n] = { value: '' };
  const appels = [];
  const sandbox = { document: { body: el('body'), getElementById: (i) => els.get(i) || null, createElement: () => el('tmp') },
    window: { location: { hash: '', search: '' }, addEventListener() {}, scrollTo() {}, AbortController, get fetch() { return sandbox.fetch; } },
    navigator: {}, console, setTimeout, clearTimeout, AbortController,
    fetch(url, opts) { if (/conditions-version/.test(url)) return Promise.resolve({ ok: true, json: async () => ({ version: '2' }) }); appels.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }); } };
  vm.runInContext(SCRIPT, vm.createContext(sandbox));
  await new Promise(r => setImmediate(r));
  form.listeners.submit[0]({ preventDefault() {} });
  await new Promise(r => setImmediate(r));
  return JSON.parse(appels[0].opts.body);
}

test('15457.L2 cochee : execution_anticipee: true part avec la demande', async () => {
  assert.equal((await contexte(true)).execution_anticipee, true);
});

test('15457.L3 non cochee : le champ n\'est pas envoye et la demande part quand meme', async () => {
  const corps = await contexte(false);
  assert.equal('execution_anticipee' in corps, false);
  assert.equal(corps.conditions_acceptees, true);
});
