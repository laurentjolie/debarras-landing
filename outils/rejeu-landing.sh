#!/bin/bash
# COPIER landing-debarras POUR Y REJOUER UN ESSAI, SANS RIEN QUI PORTERAIT UN SECRET.
#
#   bash outils/rejeu-landing.sh <destination>
#
# POURQUOI CET OUTIL EXISTE. Ticket 79 (6476) isole les quatre --add-dir du
# harnais outils/essai-injection-voies.sh : ~/Agentic/debarras est couvert par
# outils/rejeu-du-depot.sh, ~/Agentic/debarras-admin par outils/rejeu-admin.sh
# (ticket 6472), et ~/Co-work n'a pas d'equivalent. Celui-ci couvre
# ~/Agentic/landing-debarras.
#
# CE QUE LA MESURE DU 05/10/2026 A TROUVE, AVANT D'ECRIRE CE SCRIPT. Ce depot
# est un site statique sans `data/` ni `config/` propres (contrairement a
# debarras) : CNAME, HEBERGEMENT.md, index.html, index.html.avant-bascule-
# 20260917, .nojekyll, .git. `node ~/Agentic/debarras/outils/codes-hors-depot.mjs`,
# dont les parametres {depot, racine} savent deja viser un autre dossier que
# ~/Co-work, pointe sur ce depot a trouve 0 note, 0 copie de base, 0 copie de
# depot sur les 28 codes de comptes de la base vivante de `debarras`, 65
# fichiers inspectes (.git compris). Un grep cible (token, bearer, secret,
# api[_-]?key, password, motdepasse, cles privees ssh/pgp) sur les quatre
# fichiers texte ne rend rien non plus. La seule chose qui ressemble a une
# adresse technique est la constante `API` d'index.html : une URL PUBLIQUE
# (https://app.debarras.app/api/demande-acces), pas un secret — c'est la route
# que n'importe quel visiteur du site appelle depuis son navigateur.
#
# CE DEPOT N'A PAS DE SUITE DE TESTS (pas de package.json) : rien ici n'a
# besoin de `git ls-files`, donc cette copie NE FABRIQUE PAS de `.git`, a la
# difference de outils/rejeu-du-depot.sh (dont les tests 303.1, 246.12 et 09
# lisent l'index). Fabriquer un `.git` sans lecteur reviendrait a deviner un
# besoin qui n'existe pas.
#
# LA LISTE CI-DESSUS EST LA VOIE RAPIDE, PAS LA GARANTIE, et elle se perimera
# le jour ou ce depot recoit un `config/` ou un `data/` a lui — exactement la
# lecon que rejeu-du-depot.sh a tiree de COPIE_DE_BASE. La garantie est une
# MESURE, refaite ICI MEME sur la copie une fois qu'elle existe, par la meme
# fonction `compterHorsDepot` que `codes-hors-depot.mjs`, avec le depot
# `debarras` comme source des VRAIS codes et la destination comme racine a
# fouiller. Tout fichier qui en porte un est RETIRE et nomme en sortie ; s'il
# en reste un apres ce retrait, l'outil sort 1 et la copie ne sert pas.
#
# Codes de sortie : 0 la copie est prete, 1 un code a survecu a la copie,
# 2 la destination ou l'appel ne va pas.
set -euo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPOT_DEBARRAS="$HOME/Agentic/debarras"
DEST="${1:-}"

if [ -z "$DEST" ] || [ "$DEST" = "-h" ] || [ "$DEST" = "--aide" ]; then
  echo "usage : bash outils/rejeu-landing.sh <destination>" >&2
  echo "  copie le site statique (HTML, assets, CNAME) sans .git," >&2
  echo "  puis mesure sur la copie qu'aucun code de compte n'y est entre." >&2
  exit 2
fi

# Un chemin absolu, pour que la mesure et les messages parlent du meme dossier.
case "$DEST" in
  /*) : ;;
  *) DEST="$PWD/$DEST" ;;
esac

# ON N'EFFACE RIEN, JAMAIS : une destination deja peuplee est refusee, comme
# dans rejeu-du-depot.sh.
if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null || true)" ]; then
  echo "REFUS : $DEST existe et n'est pas vide. Cet outil n'efface rien." >&2
  exit 2
fi
case "$DEST/" in
  "$DEPOT"/*) echo "REFUS : la destination est dans le depot lui-meme." >&2; exit 2 ;;
esac
case "$DEST/" in
  "$HOME/Co-work"/*)
    echo "REFUS : jamais dans ~/Co-work, le dossier le plus lu du disque" >&2
    echo "        (docs/codes-d-acces-sur-le-disque.md dans debarras)." >&2
    exit 2 ;;
esac

mkdir -p "$DEST"
DEST="$(cd "$DEST" && pwd)"

# ── le contenu utile : tout ce qui n'est pas .git ───────────────────────────
# Le glob "$DEPOT"/* ne prend pas les fichiers a point (.nojekyll, .git) : on
# les ajoute explicitement sauf .git, jamais recopie.
COPIES=()
for f in "$DEPOT"/* "$DEPOT"/.nojekyll; do
  [ -e "$f" ] || continue
  nom="$(basename "$f")"
  [ "$nom" = ".git" ] && continue
  cp -a "$f" "$DEST/$nom"
  COPIES+=("$nom")
done

echo "COPIE dans $DEST"
echo "  copies : ${COPIES[*]}"
echo "  non copie : .git (pas de suite de tests ici, donc pas d'index a fabriquer)"
echo "  taille : $(du -sh "$DEST" | cut -f1)"

# ── LA MESURE, qui fait la garantie ─────────────────────────────────────────
# Memes trois bacs que codes-hors-depot.mjs (notes, copiesDeBase,
# copiesDuDepot) : on les traite tous comme porteurs ici, ce depot n'a aucune
# raison de contenir une copie de base de debarras.
MESURE="$(node --input-type=module -e '
import fs from "node:fs";
const [depotDebarras, dest] = process.argv.slice(1);
const { compterHorsDepot } = await import(depotDebarras + "/outils/codes-hors-depot.mjs");
function porteurs() {
  const r = compterHorsDepot({ depot: depotDebarras, racine: dest });
  return { ...r, porteurs: [...r.notes, ...r.copiesDeBase, ...r.copiesDuDepot].sort() };
}
let r = porteurs();
const retires = r.porteurs;
for (const p of retires) fs.rmSync(dest + "/" + p, { force: true });
if (retires.length) r = porteurs();
console.log(JSON.stringify({ inspectes: r.inspectes, codes: r.codes, retires, restants: r.porteurs }));
' "$DEPOT_DEBARRAS" "$DEST")"

node --input-type=module -e '
const m = JSON.parse(process.argv[1]);
console.log(`MESURE : ${m.codes} codes de comptes (base vivante de debarras) cherches dans ${m.inspectes} fichiers de la copie`);
if (m.retires.length) {
  console.log(`  RETIRES de la copie parce qu’ils portaient un code : ${m.retires.length}`);
  for (const p of m.retires) console.log(`    ${p}`);
} else {
  console.log("  aucun fichier de la copie ne porte de code : rien a retirer");
}
if (m.restants.length) {
  console.log(`  IL EN RESTE ${m.restants.length} APRES RETRAIT : la copie ne sert pas.`);
  for (const p of m.restants) console.log(`    ${p}`);
  process.exit(1);
}
' "$MESURE"

echo
echo "relecture manuelle attendue sur : $DEST"
