# Où vit cette page, et comment en changer

**Ce dépôt est public.** Rien ici ne doit nommer une machine, une adresse IP, un
port ou un chemin interne. Ce qui décrit l'infrastructure se range dans un
ticket de `~/Co-work/tickets/`, qui n'est pas publié. C'est la leçon du ticket
673, qui a retiré ces choses du commentaire de `index.html` le 15 septembre 2026.

## L'état au 15 septembre 2026

| Pièce | Où elle est | Comment on la change |
|---|---|---|
| la page | GitHub Pages, dépôt `laurentjolie/debarras-landing` | un `git push` sur `main` |
| le nom `debarras.app` | zone DNS chez OVH, enregistrements pointant vers GitHub Pages | console OVH, ou l'API OVH avec le jeton de `config/` |
| le domaine dans la page | le fichier `CNAME`, à la racine | une ligne à éditer |
| la route du formulaire | la constante `API`, dans le script de `index.html` | une ligne à éditer |

La page et la route du formulaire ne sont pas au même endroit, et c'est
volontaire : la page est statique et se réplique n'importe où, la route écrit
dans la base de l'application, qui tourne à la maison. Elles se rejoignent
uniquement par la constante `API`.

## La décision de Laurent, le 15 septembre 2026

Mot pour mot : « Pour le moment gratuit est mieux que souverain, trouve un truc
gratuit et qui fonctionne bien. On switchera plus tard. »

Le fond de sa préférence va à un hébergement européen. Il a tranché dans l'autre
sens en connaissance de cause, et pour une raison qui a une date de péremption :
le coût. **Ce choix n'est pas définitif, et le successeur qui lit cette page doit
le savoir avant d'y bâtir quoi que ce soit.**

## Ce que coûte un changement d'hébergeur

C'est la question qui compte, parce qu'elle décide si on peut se permettre
d'essayer. La réponse mesurée aujourd'hui : **deux lignes et un enregistrement
DNS.**

Pour déménager la page (vers Cloudflare Pages, OVH, Scaleway, Netlify, ou un
retour à GitHub Pages), il faut changer les enregistrements DNS de `debarras.app`
chez OVH, et vérifier que le fichier `CNAME` porte bien le domaine. Rien dans le
HTML ne dépend de l'hébergeur : la page est un seul fichier, sans construction,
sans dépendance, sans variable d'environnement.

Pour déménager la route du formulaire, il faut changer la constante `API` dans
`index.html`, et servir la même route au nouvel endroit. Le reste du script ne
sait pas où il poste.

**Rien d'autre n'est à toucher.** Pas de compte à migrer, pas de données à
exporter, pas de contenu à recopier. C'est ce qui rend le choix réversible, et
c'est la seule chose qu'il faut défendre quand on fera évoluer cette page :
le jour où l'on ajoute une construction, un service tiers dans la page ou une
clé d'API côté client, cette réversibilité meurt sans que personne ne s'en
aperçoive.

## Deux choses à ne pas casser en déménageant

**Le repli reste.** Quand l'envoi n'aboutit pas, la page affiche le message
tout prêt et l'adresse `contact@debarras.app` à qui l'envoyer. C'est le seul
morceau qui ne dépend d'aucun serveur, donc le seul qui marche toujours. Il ne
se retire pas parce que la route marche : un visiteur peut tomber sur une panne
le jour où on regarde ailleurs.

**Le service des photos ne suit pas la même route.** eBay vient chercher les
photos d'un lot chez nous, par une autre adresse et un autre chemin que celui du
formulaire. Les deux sujets se ressemblent et n'ont rien à voir : borner ou
déplacer l'un sans regarder l'autre casse des annonces en ligne. Le détail est
dans les tickets 240 et 688.

## Une mesure faite chez nous ne dit rien de ce que voit un visiteur

C'est le piège de cette page, et il a déjà coûté un ticket. Depuis les machines
de la maison, le nom de la route se résout autrement que depuis le reste du
monde : l'essai échoue, ou bien le navigateur réclame une permission d'accès au
réseau local, alors que pour un visiteur ordinaire il ne se passe ni l'un ni
l'autre.

**Ne conclus donc jamais que le formulaire est cassé à partir d'un essai fait
à la maison.** Mesuré le 15 septembre 2026 à 20h : depuis la voie publique, le
préflight rend 204 et la route répond. Refais toujours l'essai depuis un réseau
extérieur, ou en forçant la résolution vers l'adresse publique, avant de
toucher à la constante `API`.
