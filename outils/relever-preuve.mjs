// Ticket 11203 (25/10/2026), suite de 11198 : relève la preuve chiffrée du haut de site
// (objets vendus depuis le 1er septembre, médiane des jours après validation, date du
// relevé) et la reporte dans index.html. Relancé chaque mois par un ticket de la voie
// interfaces qui commite et pousse ; rien ne vieillit en silence, et aucun test ne
// dépend de la date du jour.
//
// Mesure reprise de ~/Co-work/livraisons/10710-apercu-haut-de-site/outils/mesurer-preuve.mjs :
// lecture seule de data/db.json (jamais d'écriture dans la base).
// « Vendu » = le lot est sorti avec issue 'vendu', sa vente n'est pas morte, sa date de
// vente est >= 2026-09-01, son compte n'est pas un compte de test.
// Délai = jours entre la validation du lot (valide_le, à défaut created_at) et la vente.
//
//   node outils/relever-preuve.mjs              dit ce qui changerait, n'écrit rien
//   node outils/relever-preuve.mjs --ecrire     réécrit index.html
//   options : --db <chemin> --html <chemin> --date AAAA-MM-JJ (date du relevé, défaut aujourd'hui)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MORTE = ['annulee', 'remboursee', 'retour', 'expiree'];
const DEPUIS = '2026-09-01';
const TEST = /test|demo|démo/i;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

export function mesurer(db) {
  const comptes = Object.fromEntries((db.comptes || []).map(c => [c.id, c.nom]));
  const jours = [];
  for (const l of db.lots || []) {
    const v = l.vente;
    if (!v || String(l.issue || '').trim() !== 'vendu' || MORTE.includes(v.statut)) continue;
    if (TEST.test(comptes[l.compte_id] || '')) continue;
    const date = String(v.date_vente || '').slice(0, 10);
    if (!date || date < DEPUIS) continue;
    const debut = new Date(l.valide_le || l.created_at);
    jours.push(Math.max(0, Math.round((new Date(date) - debut) / 86400000 * 10) / 10));
  }
  jours.sort((a, b) => a - b);
  const m = jours.length;
  const mediane = m ? (m % 2 ? jours[(m - 1) / 2] : (jours[m / 2 - 1] + jours[m / 2]) / 2) : null;
  return { vendus: m, mediane: mediane === null ? null : Math.round(mediane) };
}

export function dateEnLettres(iso) {
  const [a, mo, j] = iso.split('-').map(Number);
  if (!a || !mo || !j || mo > 12 || j > 31) throw new Error(`date illisible : ${iso}`);
  return `${j} ${MOIS[mo - 1]} ${a}`;
}

const MOTIFS = {
  vendus: /(<b>)\d+( objets vendus depuis le 1er septembre<\/b>)/,
  mediane: /(vendus en )\d+( jours en médiane après leur validation)/,
  date: /(<small>Chiffres relevés le )[^<]+(\.<\/small>)/,
};

// Réécrit les trois valeurs ; refuse si un des motifs n'est pas trouvé exactement une fois,
// pour ne jamais pousser une page à moitié mise à jour.
export function reecrire(html, { vendus, mediane, date }) {
  if (!Number.isInteger(vendus) || vendus < 1) throw new Error(`nombre de vendus refusé : ${vendus}`);
  if (!Number.isInteger(mediane) || mediane < 0) throw new Error(`médiane refusée : ${mediane}`);
  const valeurs = { vendus: String(vendus), mediane: String(mediane), date: dateEnLettres(date) };
  let sortie = html;
  for (const [cle, motif] of Object.entries(MOTIFS)) {
    const n = html.match(new RegExp(motif.source, 'g'))?.length || 0;
    if (n !== 1) throw new Error(`motif « ${cle} » trouvé ${n} fois dans index.html, attendu 1`);
    sortie = sortie.replace(motif, `$1${valeurs[cle]}$2`);
  }
  return sortie;
}

export function lire(html) {
  return {
    vendus: html.match(MOTIFS.vendus)?.[0].match(/\d+/)[0],
    mediane: html.match(MOTIFS.mediane)?.[0].match(/\d+/)[0],
    date: html.match(MOTIFS.date)?.[0].replace(/^<small>Chiffres relevés le /, '').replace(/\.<\/small>$/, ''),
  };
}

function option(nom, defaut) {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : defaut;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dbChemin = option('--db', '/home/claude/Agentic/debarras/data/db.json');
  const htmlChemin = option('--html', path.join(DEPOT, 'index.html'));
  const d = new Date();
  const aujourdhui = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const date = option('--date', aujourdhui);
  const mesure = mesurer(JSON.parse(fs.readFileSync(dbChemin, 'utf8')));
  const html = fs.readFileSync(htmlChemin, 'utf8');
  const avant = lire(html);
  const neuf = reecrire(html, { ...mesure, date });
  const apres = lire(neuf);
  console.log(`avant : ${avant.vendus} vendus, ${avant.mediane} jours en médiane, relevé le ${avant.date}`);
  console.log(`après : ${apres.vendus} vendus, ${apres.mediane} jours en médiane, relevé le ${apres.date}`);
  if (process.argv.includes('--ecrire')) {
    fs.writeFileSync(htmlChemin, neuf);
    console.log(`écrit : ${htmlChemin}`);
  } else {
    console.log('rien écrit (ajoute --ecrire)');
  }
}
