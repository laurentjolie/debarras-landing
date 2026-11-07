// Ticket 15070 (07/11/2026), suite de l'audit 15015 (suggestion 2) et de l'audit
// 14289 (changements 1, 2 et 5) : la page dit la vérité sur le délai (le code
// arrive en 4 minutes en médiane, la nuit il attend 8 h), on « commence » au lieu
// de « demander un accès », et l'écran de fin a un bouton pour ouvrir Débarras.
// Lit le VRAI index.html, aucun réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reecrire } from '../outils/relever-preuve.mjs';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');
const entre = (a, b) => { const i = HTML.indexOf(a); assert.ok(i >= 0, a); return HTML.slice(i, HTML.indexOf(b, i)); };
const DELAI = "Ton code arrive dans quelques minutes à cette adresse (demain matin à partir de 8 h si tu écris la nuit). Regarde aussi les indésirables.";

test('15070.1 plus aucun « sous 24 h », ni « Demander un accès »', () => {
  assert.doesNotMatch(HTML, /24\s?h/);
  assert.doesNotMatch(HTML, /Demander un accès/);
  assert.doesNotMatch(HTML, /Envoyer ma demande/);
});

test('15070.2 sous le bouton du formulaire, le délai vrai et les indésirables', () => {
  const note = entre('<span class="form-note">', '</span>');
  assert.equal(note.replace('<span class="form-note">', '').replace(/\s+/g, ' ').trim(), DELAI);
  assert.match(entre('<div class="form-actions">', '</div>'), />Recevoir mon code</);
});

test('15070.3 l\'écran de fin dit le délai et porte « J\'ai reçu mon courriel : ouvrir Débarras »', () => {
  const merci = entre('<div class="merci" id="merci">', '<!-- Demande retenue');
  assert.match(merci, /quelques minutes/);
  assert.match(merci, /demain matin à partir de 8 h si tu écris la nuit/);
  assert.match(merci, /indésirables/);
  assert.match(merci, /<a class="bouton bouton--large" href="https:\/\/app\.debarras\.app">J'ai reçu mon courriel : ouvrir Débarras<\/a>/);
  // L'écran « On vérifie ta demande. » (demande retenue) reste tel quel : ni délai ni code.
  assert.match(entre('<div class="merci" id="controle">', '</div>'), /On vérifie ta demande\./);
});

test('15070.4 on commence : trois boutons « Commencer avec une photo », dont un au milieu, et « Commencer » dans la barre', () => {
  assert.match(entre('<nav class="barre">', '</nav>'), /<a class="bouton" href="#acces">Commencer<\/a>/);
  assert.equal(HTML.split('href="#acces">Commencer avec une photo</a>').length - 1, 3);
  const milieu = entre('Le parcours d\'un objet', 'Ce qui est passé par là');
  assert.match(milieu, /href="#acces">Commencer avec une photo<\/a>/);
  assert.match(HTML, /Ton code arrive par courriel\./);
  assert.match(entre('<div class="intro">', '</div>'), /<span class="etiquette">Inscription<\/span>/);
  assert.match(HTML, /@media \(max-width: 640px\) \{[^}]*\.barre \{[^}]*position: sticky; top: 0;/);
});

test('15070.5 le premier écran dit ce que c\'est, sans promesse d\'argent ; la preuve sans « après leur validation », relevé compris', () => {
  const haut = entre('<header class="ouverture ouverture--preuve">', '</header>');
  assert.match(haut, /<span class="etiquette">Une application faite par deux parents · en bêta<\/span>/);
  assert.match(haut, /Débarras est une application\./);
  assert.doesNotMatch(haut, /tu touches l'argent/);
  assert.doesNotMatch(HTML, /après leur validation/);
  assert.match(reecrire(HTML, { vendus: 30, mediane: 20, date: '2026-12-01' }), /vendus en 20 jours en médiane ·/);
});

// Le libellé du bouton de fin (un peu plus de 39 caractères) dépasse un écran de
// téléphone tant que .bouton reste en nowrap : mesure du 07/11/2026, #merci à 394 px
// de large pour un écran de 375 (run 15092). Sur l'écran de fin, le bouton passe à la ligne.
test('15070.6 sur l\'écran de fin, le bouton peut passer à la ligne (pas de débordement à 375 px)', () => {
  assert.match(HTML, /\.merci \.bouton \{[^}]*white-space: normal;[^}]*\}/);
});
