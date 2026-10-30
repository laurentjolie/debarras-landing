// Tests hors réseau du VRAI script du formulaire (extrait de ../index.html,
// pas une réécriture) : fetch est injecté, aucune requête ne part jamais sur
// le réseau. Ticket rang 44.21 (12/10/2026) : vérifie que la page distingue
// maintenant le succès normal du contrôle « a_verifier », sans jamais afficher
// un faux succès sur une réponse illisible.
//
// Dépôt sans package.json ni suite existante : lancer avec
//   node --test tests/demande-acces-controle.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DEPOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = fs.readFileSync(path.join(DEPOT, 'index.html'), 'utf8');

function extraireScript(html) {
  const m = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
  if (!m) throw new Error('script introuvable dans index.html (balise <script> sans attribut attendue)');
  return m[1];
}
const SCRIPT = extraireScript(HTML);

function creerClassList(el) {
  return {
    add(c) { el._classes.add(c); },
    remove(c) { el._classes.delete(c); },
    toggle(c, force) {
      if (force === undefined) { el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c); }
      else if (force) el._classes.add(c); else el._classes.delete(c);
    },
    contains(c) { return el._classes.has(c); },
  };
}

function creerElement(id) {
  const el = {
    id, _classes: new Set(), style: {}, textContent: '', disabled: false,
    listeners: {},
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelector() { return null; },
    appendChild() {}, removeChild() {}, scrollIntoView() {},
  };
  el.classList = creerClassList(el);
  return el;
}

// Construit le DOM minimal dont CE script a besoin (relevé par grep sur le
// script réel : getElementById, classList, querySelector, scrollIntoView,
// addEventListener, form.elements). Pas un navigateur, juste assez pour que
// le vrai script tourne sans toucher le réseau.
function construireContexte({ search = '', hash = '' } = {}) {
  const ids = ['repli', 'repli-texte', 'repli-motif', 'merci', 'controle', 'controle-titre', 'btn-envoyer', 'btn-copier', 'bloc-provenance-qui'];
  const elements = new Map();
  for (const id of ids) elements.set(id, creerElement(id));
  elements.get('btn-envoyer').textContent = 'Envoyer ma demande';

  const champs = ['prenom', 'nom', 'email', 'telephone', 'adresse', 'volume', 'quoi', 'provenance', 'provenance_qui', 'champ_b7'];
  const formElements = {};
  for (const nom of champs) formElements[nom] = { value: '' };
  // La case des conditions (ticket 13526) : cochee par defaut dans ces tests, qui
  // ne portent pas sur elle ; tests/13526-case-conditions.test.mjs la decoche.
  formElements.conditions = { checked: true };

  const form = creerElement('form-acces');
  form.elements = formElements;
  elements.set('form-acces', form);

  const body = creerElement('body');

  const fetchAppels = [];
  let fetchImpl = async () => { throw new Error('fetch non configuré pour ce test'); };

  const document_ = {
    body,
    getElementById(id) { return elements.get(id) || null; },
    createElement() { return creerElement('tmp'); },
  };
  const location = { hash, search };
  const ecouteursFenetre = {};
  const window_ = {
    location,
    addEventListener(type, fn) { (ecouteursFenetre[type] = ecouteursFenetre[type] || []).push(fn); },
    scrollTo() {},
    get fetch() { return sandbox.fetch; },
    AbortController: globalThis.AbortController,
  };
  const sandbox = {
    document: document_,
    window: window_,
    navigator: { clipboard: undefined },
    console,
    setTimeout, clearTimeout,
    AbortController: globalThis.AbortController,
    fetch(url, opts) {
      // Ticket 13571 (30/10/2026) : la lecture de la version des conditions a
      // l'ouverture (ticket 13540) n'est pas une soumission, elle ne se compte pas.
      if (/conditions-version/.test(url)) return Promise.resolve({ ok: true, json: async () => ({ version: null }) });
      fetchAppels.push({ url, opts });
      return Promise.resolve().then(() => fetchImpl(url, opts));
    },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SCRIPT, ctx, { filename: 'index.html#script' });

  return {
    form, elements, fetchAppels,
    definirReponse(impl) { fetchImpl = impl; },
    // Simule un clic sur un lien d'ancre : l'ancre change, puis hashchange.
    changerAncre(h) {
      location.hash = h;
      for (const fn of ecouteursFenetre.hashchange || []) fn({});
    },
    async soumettre(valeurs) {
      for (const [nom, v] of Object.entries(valeurs)) form.elements[nom].value = v;
      const gestionnaire = form.listeners.submit[0];
      gestionnaire({ preventDefault() {} });
      // Laisse la chaîne de .then (fetch -> r.json -> décision d'écran) se
      // dérouler : aucun minuteur réel n'est nécessaire, la réponse est déjà
      // résolue plus haut.
      for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
    },
    visible(id) { return elements.get(id).classList.contains('visible'); },
    texte(id) { return elements.get(id).textContent; },
  };
}

const DONNEES_VALIDES = {
  prenom: 'Jo', nom: 'Exemple', email: 'jo@exemple.fr', telephone: '0612345678',
  adresse: '', volume: '3', quoi: '', provenance: '',
};

test('corps humain, réponse normale : écran "C\'est envoyé", pas de contrôle ni de repli', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  await c.soumettre({ ...DONNEES_VALIDES, champ_b7: '' });

  assert.equal(c.fetchAppels.length, 1, 'une seule tentative, aucune soumission réelle');
  assert.equal(c.fetchAppels[0].url, 'https://app.debarras.app/api/demande-acces');
  assert.equal(c.visible('merci'), true);
  assert.equal(c.visible('controle'), false);
  assert.equal(c.visible('repli'), false);
});

test('corps suspect (piège rempli), réponse retenue : écran de contrôle, sans promesse de délai ni de code', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({
    ok: true, status: 200,
    json: async () => ({ ok: true, etat: 'a_verifier', message: 'On vérifie ta demande.' }),
  }));
  await c.soumettre({ ...DONNEES_VALIDES, champ_b7: 'ACME SEO Ltd' });

  const appel = c.fetchAppels[0];
  assert.equal(appel.opts.method, 'POST');
  const corpsEnvoye = JSON.parse(appel.opts.body);
  assert.equal(corpsEnvoye.champ_b7, 'ACME SEO Ltd', 'le piège part bien tel que rempli, sans être filtré côté front');
  assert.equal(typeof corpsEnvoye.duree_ms, 'number');

  assert.equal(c.visible('controle'), true);
  assert.equal(c.visible('merci'), false);
  assert.equal(c.visible('repli'), false);
  const texte = c.texte('controle-titre');
  assert.match(texte, /vérifie/i);
  assert.doesNotMatch(texte, /24\s*h/i, 'aucune promesse de délai dans l\'écran de contrôle');
  assert.doesNotMatch(texte, /code/i, 'aucune promesse de code dans l\'écran de contrôle');
});

test('réponse d\'erreur (429, plafond) : écran de repli avec le motif du serveur', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({
    ok: false, status: 429,
    json: async () => ({ erreur: 'Trop de demandes depuis cette connexion.' }),
  }));
  await c.soumettre(DONNEES_VALIDES);

  assert.equal(c.visible('repli'), true);
  assert.equal(c.visible('merci'), false);
  assert.equal(c.visible('controle'), false);
  assert.match(c.texte('repli-motif'), /Trop de demandes/);
});

test('réponse 200 incohérente (pas ok:true) : erreur visible, jamais un faux succès', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) }));
  await c.soumettre(DONNEES_VALIDES);

  assert.equal(c.visible('merci'), false, 'un 200 incohérent ne doit jamais déclencher le faux succès');
  assert.equal(c.visible('controle'), false);
  assert.equal(c.visible('repli'), true);
});

test('réponse 200 au corps illisible (JSON invalide) : erreur visible, jamais un faux succès', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => { throw new Error('JSON invalide'); } }));
  await c.soumettre(DONNEES_VALIDES);

  assert.equal(c.visible('merci'), false);
  assert.equal(c.visible('controle'), false);
  assert.equal(c.visible('repli'), true);
});

for (const etat of ['refusee', 'inconnu', 42]) {
  test('réponse 200, ok:true, état hors contrat (' + JSON.stringify(etat) + ') : erreur visible, jamais un faux succès', async () => {
    const c = construireContexte();
    c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, etat }) }));
    await c.soumettre(DONNEES_VALIDES);

    assert.equal(c.visible('merci'), false, 'état hors contrat accepté comme succès normal');
    assert.equal(c.visible('controle'), false);
    assert.equal(c.visible('repli'), true);
  });
}

// ── Ticket 8977 : le code de groupe (?d=...), sans cookie ni bandeau ───────

test('un lien avec ?d=issy1 déclenche, dès l\'ouverture, un ping silencieux vers le compteur de visites', async () => {
  const c = construireContexte({ search: '?d=issy1' });
  // Le ping part à la construction du script (ouverture de la page), avant
  // toute soumission du formulaire.
  assert.equal(c.fetchAppels.length, 1);
  assert.equal(c.fetchAppels[0].url, 'https://app.debarras.app/api/visite-landing');
  assert.deepEqual(JSON.parse(c.fetchAppels[0].opts.body), { code: 'issy1' });
});

test('un lien sans ?d= ne déclenche aucun ping : rien à attribuer, rien n\'est envoyé', async () => {
  const c = construireContexte({ search: '' });
  assert.equal(c.fetchAppels.length, 0);
});

test('le code ?d=... est recopié dans la demande d\'accès à l\'envoi du formulaire', async () => {
  const c = construireContexte({ search: '?d=issy1' });
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  await c.soumettre({ ...DONNEES_VALIDES, champ_b7: '' });

  // Deux fetch : le ping de visite à l'ouverture, puis l'envoi du formulaire.
  assert.equal(c.fetchAppels.length, 2);
  const appelFormulaire = c.fetchAppels[1];
  assert.equal(appelFormulaire.url, 'https://app.debarras.app/api/demande-acces');
  const corpsEnvoye = JSON.parse(appelFormulaire.opts.body);
  assert.equal(corpsEnvoye.code, 'issy1');
});

test('sans ?d=..., la demande d\'accès porte un code vide, jamais une valeur devinée', async () => {
  const c = construireContexte({ search: '' });
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  await c.soumettre({ ...DONNEES_VALIDES, champ_b7: '' });

  assert.equal(c.fetchAppels.length, 1, 'aucun ping sans code, un seul fetch, celui du formulaire');
  const corpsEnvoye = JSON.parse(c.fetchAppels[0].opts.body);
  assert.equal(corpsEnvoye.code, '');
});

test('un échec du ping de visite est ignoré en silence : rien de visible, la page continue', async () => {
  const c = construireContexte({ search: '?d=issy1' });
  c.definirReponse(async () => { throw new Error('réseau coupé'); });
  // La construction ne doit pas jeter, même si le ping échoue.
  await new Promise((r) => setImmediate(r));
  assert.equal(c.visible('repli'), false);
  assert.equal(c.visible('merci'), false);
  assert.equal(c.visible('controle'), false);
});

// Ticket 9660 (suite de 9526) : le formulaire suit le serveur (ticket 15.1),
// seul l'e-mail est obligatoire. Aucun compte réel, fetch injecté.
test('seul un e-mail valide suffit : la demande part, sans prénom, nom ni téléphone', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  await c.soumettre({ prenom: '', nom: '', email: 'jo@exemple.fr', telephone: '', adresse: '', volume: '', quoi: '', provenance: '', champ_b7: '' });
  assert.equal(c.fetchAppels.length, 1);
  const corps = JSON.parse(c.fetchAppels[0].opts.body);
  assert.equal(corps.email, 'jo@exemple.fr');
  assert.equal(corps.prenom, '');
  assert.equal(c.visible('merci'), true);
});

test('un téléphone court n\'est plus refusé côté page', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  await c.soumettre({ ...DONNEES_VALIDES, telephone: '12', champ_b7: '' });
  assert.equal(c.fetchAppels.length, 1);
});

for (const email of ['', 'pas-une-adresse', 'a@b', '@x.fr', 'a b@c.fr']) {
  test('e-mail ' + JSON.stringify(email) + ' : refusé, rien n\'est envoyé', async () => {
    const c = construireContexte();
    c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    await c.soumettre({ ...DONNEES_VALIDES, email, champ_b7: '' });
    assert.equal(c.fetchAppels.length, 0);
    assert.equal(c.visible('merci'), false);
  });
}

test('aucun champ autre que l\'e-mail et la case des conditions n\'est required dans le HTML', () => {
  // La case (ticket 13526, demande de Laurent du 29/10/2026) est la seule obligation ajoutee.
  const requis = [...HTML.matchAll(/<(?:input|select|textarea)\b[^>]*\brequired\b[^>]*>/g)].map(m => m[0]);
  assert.equal(requis.length, 2, requis.join('\n'));
  assert.match(requis[0], /name="email"/);
  assert.match(requis[1], /name="conditions"/);
});

// ticket 10680 : trois champs au lieu de huit (audit 10512, validé par Laurent le 23/10/2026)
test('ticket 10680 : le formulaire ne demande plus nom, téléphone ni adresse postale', () => {
  const noms = [...HTML.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map(m => m[1]);
  // provenance_qui : la ligne « de la part de qui » du ticket 11859, jointe à provenance à l'envoi.
  assert.deepEqual(noms.sort(), ['champ_b7', 'conditions', 'email', 'prenom', 'provenance', 'provenance_qui', 'quoi', 'volume'].sort());
});

test('ticket 10680 : volume et provenance sont des pastilles de 44 px, pas des champs visibles', () => {
  assert.match(HTML, /<input type="hidden" id="f-volume" name="volume"/);
  assert.match(HTML, /<input type="hidden" id="f-provenance" name="provenance"/);
  assert.match(HTML, /\.pastille \{[^}]*min-height: 44px/);
  assert.equal((HTML.match(/class="pastille"/g) || []).length, 8);
});

test('ticket 10680 : l\'envoi ne porte plus nom, téléphone ni adresse, et une pastille choisie part dans volume', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  const pastille = { attrs: { 'aria-pressed': 'false', 'data-valeur': 'Entre 5 et 20' },
    getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } };
  pastille.parentNode = { children: [pastille], getAttribute: () => 'volume' };
  pastille.closest = () => pastille;
  c.form.listeners.click[0]({ target: pastille });
  assert.equal(pastille.attrs['aria-pressed'], 'true');
  await c.soumettre({ prenom: 'Jo', email: 'jo@exemple.fr', quoi: 'des livres', champ_b7: '' });
  const corps = JSON.parse(c.fetchAppels[0].opts.body);
  assert.equal(corps.volume, 'Entre 5 et 20');
  for (const k of ['nom', 'telephone', 'adresse']) assert.equal(k in corps, false, k);
  c.form.listeners.click[0]({ target: pastille });
  assert.equal(c.form.elements.volume.value, '', 'un second appui défait le choix');
});

// Ticket 11859 (suite de 11853) : le parrainage part sans lien codé, la
// provenance libre est sa seule mesure ; les pastilles de 10680 ne doivent
// pas perdre « de la part de qui ».
function pastilleProvenance(valeurPastille) {
  const p = { attrs: { 'aria-pressed': 'false', 'data-valeur': valeurPastille },
    getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } };
  p.parentNode = { children: [p], getAttribute: () => 'provenance' };
  p.closest = () => p;
  return p;
}

test('ticket 11859 : « Un ami » et « Morgane » donnent une provenance qui contient Morgane, envoi et repli', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  const bloc = c.elements.get('bloc-provenance-qui');
  bloc.hidden = true;
  c.form.listeners.click[0]({ target: pastilleProvenance('Un ami') });
  assert.equal(bloc.hidden, false, 'la ligne « qui » apparaît après « Un ami »');
  await c.soumettre({ email: 'jo@exemple.fr', provenance_qui: '  Morgane ', champ_b7: '' });
  const corps = JSON.parse(c.fetchAppels[0].opts.body);
  assert.equal(corps.provenance, 'Un ami : Morgane');
  assert.equal('provenance_qui' in corps, false, 'le serveur ne reçoit toujours qu\'un champ provenance');
  assert.match(c.texte('repli-texte'), /Où j'en ai entendu parler : Un ami : Morgane/);
});

test('ticket 11859 : « Autre » montre aussi la ligne et la joint', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  c.form.listeners.click[0]({ target: pastilleProvenance('Autre') });
  assert.equal(c.elements.get('bloc-provenance-qui').hidden, false);
  await c.soumettre({ email: 'jo@exemple.fr', provenance_qui: 'le marché', champ_b7: '' });
  assert.equal(JSON.parse(c.fetchAppels[0].opts.body).provenance, 'Autre : le marché');
});

test('ticket 11859 : avec LinkedIn la ligne reste cachée et ce qu\'on y avait tapé ne part pas', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  c.form.listeners.click[0]({ target: pastilleProvenance('LinkedIn') });
  assert.equal(c.elements.get('bloc-provenance-qui').hidden, true);
  await c.soumettre({ email: 'jo@exemple.fr', provenance_qui: 'Morgane', champ_b7: '' });
  assert.equal(JSON.parse(c.fetchAppels[0].opts.body).provenance, 'LinkedIn');
});

test('ticket 11859 : « Un ami » sans nom reste « Un ami », et un nom trop long est coupé à 60', async () => {
  const c = construireContexte();
  c.definirReponse(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  c.form.listeners.click[0]({ target: pastilleProvenance('Un ami') });
  await c.soumettre({ email: 'jo@exemple.fr', provenance_qui: '', champ_b7: '' });
  assert.equal(JSON.parse(c.fetchAppels[0].opts.body).provenance, 'Un ami');
  await c.soumettre({ email: 'jo@exemple.fr', provenance_qui: 'x'.repeat(90), champ_b7: '' });
  assert.equal(JSON.parse(c.fetchAppels[1].opts.body).provenance, 'Un ami : ' + 'x'.repeat(60));
});

test('ticket 11859 : la ligne « qui » est dans le HTML, cachée au départ, 60 caractères au plus', () => {
  assert.match(HTML, /<div class="provenance-qui" id="bloc-provenance-qui" hidden>/);
  assert.match(HTML, /<input id="f-provenance-qui" name="provenance_qui" type="text" maxlength="60"/);
});

// ── Ticket 12418 : l'ouverture du formulaire, comptée par code ─────────────
// Entre « page ouverte » et « demande envoyée », un seul jalon de plus :
// le passage sur #acces, une fois par chargement, et seulement avec un code.

function appelsFormulaire(c) {
  return c.fetchAppels
    .filter((a) => a.url === 'https://app.debarras.app/api/visite-landing')
    .map((a) => JSON.parse(a.opts.body))
    .filter((corps) => corps.etape === 'formulaire');
}

test('ticket 12418 : avec ?d=issy1, ouvrir #acces envoie {code, etape: "formulaire"} au compteur', () => {
  const c = construireContexte({ search: '?d=issy1' });
  assert.equal(appelsFormulaire(c).length, 0, 'rien avant l\'ouverture du formulaire');
  c.changerAncre('#acces');
  assert.deepEqual(appelsFormulaire(c), [{ code: 'issy1', etape: 'formulaire' }]);
  const appel = c.fetchAppels.find((a) => JSON.parse(a.opts.body).etape === 'formulaire');
  assert.equal(appel.opts.method, 'POST');
  assert.equal(appel.opts.credentials, undefined, 'aucun cookie demandé');
});

test('ticket 12418 : une seule fois par chargement, même après des allers-retours', () => {
  const c = construireContexte({ search: '?d=issy1' });
  c.changerAncre('#acces');
  c.changerAncre('');
  c.changerAncre('#acces');
  assert.equal(appelsFormulaire(c).length, 1);
});

test('ticket 12418 : une page ouverte directement sur #acces le signale aussi, une fois', () => {
  const c = construireContexte({ search: '?d=issy1', hash: '#acces' });
  assert.deepEqual(appelsFormulaire(c), [{ code: 'issy1', etape: 'formulaire' }]);
  assert.equal(c.fetchAppels.length, 2, 'le ping de visite et celui du formulaire, rien d\'autre');
});

test('ticket 12418 : sans ?d=, ouvrir le formulaire n\'envoie rien', () => {
  const c = construireContexte({ search: '' });
  c.changerAncre('#acces');
  assert.equal(c.fetchAppels.length, 0);
});

test('ticket 12418 : un échec du ping du formulaire est ignoré en silence', async () => {
  const c = construireContexte({ search: '?d=issy1' });
  c.definirReponse(async () => { throw new Error('réseau coupé'); });
  c.changerAncre('#acces');
  await new Promise((r) => setImmediate(r));
  assert.equal(c.visible('repli'), false);
  assert.equal(c.visible('merci'), false);
  assert.equal(c.visible('controle'), false);
});
