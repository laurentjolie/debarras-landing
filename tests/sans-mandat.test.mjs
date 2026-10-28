// Ticket 13126 (28/10/2026) : décision D-2026-10-26-a « Pas de mandat » (docs/REGLES.md
// de l'application) : Débarras est un logiciel d'aide à la vente, c'est le déposant qui
// vend. Le 28/10/2026, equipe.html disait encore « une équipe d'IA qui vend tes affaires
// pour toi », les pieds de page « Vend sur leboncoin, Vinted et eBay », et llms.txt comme
// le JSON-LD de l'accueil « dépôt-vente en ligne » : pages écrites avant la décision et
// jamais relues contre elle. Lit le disque, aucun réseau.
//
//   node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PUBLIES = fs.readdirSync(DEPOT).filter(f => f.endsWith('.html') || f === 'llms.txt');

// Tournures qui présentent Débarras comme vendeur pour autrui.
const INTERDITES = [
  /vend tes affaires/i,
  /\bpour toi\b/i,
  /à ta place/i,
  /à votre place/i,
  /\bVend sur\b/,
  /dépôt-vente/i,
  /mandataire/i,
];

// Ticket 13149 (28/10/2026) : la même décision vise aussi « encaisse ou reverse pour
// autrui ». Le 28/10/2026, equipe.html disait encore que Benoît « te reverse ton dû »,
// « De la photo au virement » et « le paiement de la plateforme » remis à Benoît, et
// l'accueil montrait l'écran « Ce qu'on te doit » (« à te virer aujourd'hui », « déjà
// viré ») avec un texte alternatif « le montant à te virer » : la liste de 13126 ne
// couvrait que la vente. On décrit le suivi des ventes, on ne promet ni reversement, ni
// paiement direct, ni circuit d'argent (le modèle et les flux : carte 12674).
const INTERDITES_ARGENT = [
  /\brevers/i,
  /\bvir(er|ement|é)(?![a-z])/i,
  /\bencaiss/i,
  /on te doit/i,
  /paiement de la plateforme/i,
];

// Illustrations dont l'image elle-même promet un reversement : un texte alternatif
// neutre ne suffirait pas, l'écran dit « à te virer aujourd'hui ».
const IMAGES_DE_REVERSEMENT = ['ecran-ce-quon-te-doit.png'];

test('aucune page publiée ne présente Débarras comme vendeur pour autrui', () => {
  assert.ok(PUBLIES.includes('index.html') && PUBLIES.includes('equipe.html'));
  const trouvees = [];
  for (const f of PUBLIES) {
    fs.readFileSync(path.join(DEPOT, f), 'utf8').split('\n').forEach((ligne, i) => {
      for (const re of INTERDITES) if (re.test(ligne)) trouvees.push(`${f}:${i + 1} ${re}`);
    });
  }
  assert.deepEqual(trouvees, []);
});

test('la page équipe dit que le déposant reste le vendeur', () => {
  const html = fs.readFileSync(path.join(DEPOT, 'equipe.html'), 'utf8');
  assert.match(html, /tu restes le vendeur/);
});

test('13149 : aucune page publiée ne promet que Débarras encaisse ou reverse', () => {
  const trouvees = [];
  for (const f of PUBLIES) {
    fs.readFileSync(path.join(DEPOT, f), 'utf8').split('\n').forEach((ligne, i) => {
      for (const re of INTERDITES_ARGENT) if (re.test(ligne)) trouvees.push(`${f}:${i + 1} ${re}`);
      for (const img of IMAGES_DE_REVERSEMENT) if (ligne.includes(img)) trouvees.push(`${f}:${i + 1} ${img}`);
    });
  }
  assert.deepEqual(trouvees, []);
});
