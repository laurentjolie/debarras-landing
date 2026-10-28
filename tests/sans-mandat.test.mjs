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
