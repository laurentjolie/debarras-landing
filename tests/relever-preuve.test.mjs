// Ticket 11203 (25/10/2026), suite de 11198 : l'outil qui relève chaque mois la preuve
// chiffrée du haut de site. Données fabriquées, aucune lecture de la base, et rien qui
// dépende de la date du jour : ce test ne rougit pas avec le temps.
//
//   node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mesurer, reecrire, lire, dateEnLettres } from '../outils/relever-preuve.mjs';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');

const lot = (jours, extra = {}) => ({
  compte_id: 'c1', issue: 'vendu', valide_le: '2026-09-01T00:00:00Z',
  vente: { statut: 'payee', date_vente: new Date(Date.parse('2026-09-01T00:00:00Z') + jours * 86400000).toISOString() },
  ...extra,
});

test('11203 : ne compte que les ventes vivantes, réelles, depuis le 1er septembre', () => {
  const db = {
    comptes: [{ id: 'c1', nom: 'Martine' }, { id: 'c2', nom: 'Compte test' }],
    lots: [
      lot(10), lot(20), lot(30),
      lot(5, { compte_id: 'c2' }),
      lot(5, { issue: 'retire' }),
      lot(5, { vente: { statut: 'remboursee', date_vente: '2026-09-10' } }),
      lot(5, { vente: { statut: 'payee', date_vente: '2026-08-31' } }),
      { compte_id: 'c1', issue: 'vendu' },
    ],
  };
  assert.deepEqual(mesurer(db), { vendus: 3, mediane: 20 });
});

test('11203 : médiane d\'un nombre pair de ventes, arrondie au jour', () => {
  assert.deepEqual(mesurer({ comptes: [], lots: [lot(10), lot(13)] }), { vendus: 2, mediane: 12 });
  assert.deepEqual(mesurer({ comptes: [], lots: [] }), { vendus: 0, mediane: null });
});

test('11203 : la date du relevé s\'écrit en lettres', () => {
  assert.equal(dateEnLettres('2027-08-15'), '15 août 2027');
  assert.equal(dateEnLettres('2026-11-02'), '2 novembre 2026');
  assert.throws(() => dateEnLettres('2026-13-01'));
});

test('11203 : réécrit les trois valeurs du vrai index.html, et rien d\'autre', () => {
  const neuf = reecrire(HTML, { vendus: 41, mediane: 17, date: '2026-12-01' });
  assert.deepEqual(lire(neuf), { vendus: '41', mediane: '17', date: '1er décembre 2026' });
  assert.equal(neuf.length - HTML.length,
    '41'.length - lire(HTML).vendus.length + '17'.length - lire(HTML).mediane.length
    + '1er décembre 2026'.length - lire(HTML).date.length);
  assert.match(neuf, /<b>41 objets vendus depuis le 1er septembre<\/b> · vendus en 17 jours en médiane après leur validation/);
});

test('11203 : refuse une mesure vide ou une page où un motif manque', () => {
  assert.throws(() => reecrire(HTML, { vendus: 0, mediane: null, date: '2026-12-01' }), /vendus refusé/);
  const sansDate = HTML.replace(/<small>Chiffres relevés le [^<]+\.<\/small>/, '');
  assert.throws(() => reecrire(sansDate, { vendus: 3, mediane: 4, date: '2026-12-01' }), /« date » trouvé 0 fois/);
});

// 11601 : le relevé mensuel tourne le 1er ; la page dit déjà « depuis le 1er septembre ».
test('11601 : le premier du mois s\'écrit « 1er »', () => {
  assert.equal(dateEnLettres('2026-11-01'), '1er novembre 2026');
  assert.equal(dateEnLettres('2027-01-01'), '1er janvier 2027');
  const neuf = reecrire(HTML, { vendus: 3, mediane: 4, date: '2026-11-01' });
  assert.match(neuf, /<small>Chiffres relevés le 1er novembre 2026\.<\/small>/);
});
