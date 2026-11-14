# Handoff : SUTOM en français

Document de reprise. **Aucun secret ici** : les valeurs sensibles vivent uniquement dans `/app/sutom/.env` sur ociub (mode 600, non versionné).

Il contient : ce qu'est le jeu, toutes les décisions prises et pourquoi, l'architecture réelle, les procédures, et ce qui reste ouvert.

## 1. En bref

- Jeu SUTOM francophone, **deux mots par jour** : un de minuit à midi (« matin »), un de midi à minuit (« après-midi »), heure Europe/Paris.
- Mots de **8 à 10 lettres**, **9 essais**, **première lettre imposée**.
- Couleurs : rouge = bien placée, jaune = présente ailleurs, gris = absente.
- **Aides payantes** : enlever une lettre qui n'est pas dans le mot (−2 pts), faire révéler une lettre non encore connue (−5 pts).
- **Connexion Google OAuth** obligatoire pour jouer, ouverte à tout compte Google.
- **Classement global** entre joueurs connectés (score, victoires, % , séries).
- **Rattrapage** : un joueur peut jouer n'importe quelle période passée non encore jouée.
- Production : https://sutom.laurans.org — ociub, Oracle Cloud **aarch64**, Docker.
- Dépôt public : https://github.com/blaurans/sutom, branche `main`. Pas de CI : déploiement par build sur le serveur.
- Objectif d'usage : jeu de famille. Pas d'ouverture publique annoncée.

## 2. Décisions prises (et raisons)

### 2.1 Règles de jeu

| Décision | Raison / historique |
|---|---|
| 2 mots par jour (minuit→midi, midi→minuit) | Demande explicite du 14/11/2026. Remplace « 1 mot par jour ». |
| 8 à 10 lettres, longueur variable selon la période | Demande initiale : « 8 ou plus ». Longueur libre entre 8 et 10, imposée par le mot tiré. |
| 9 essais (et non 6) | Demande initiale : partie jugée difficile, 9 essais accordés. |
| Première lettre donnée et **non modifiable** | Règle SUTOM + « mode dur ». Le serveur la vérifie à chaque essai. |
| Lettres trouvées rouges **reportées en rouge** sur la ligne suivante, **mais remplaçables** | Demande du 14/11/2026 : on doit pouvoir tester d'autres mots (noms propres impossibles, etc.). Seule la 1re lettre reste fixée. |
| Pas de contrainte de réutilisation des lettres | La contrainte « mode dur Wordle » a été implémentée puis **retirée** : elle bloquait le joueur. La difficulté devait venir du mot, pas des contraintes. |
| Saisie **sans accents** (É→E, Ç→C), comparaison normalisée | Simplicité mobile. Formes fléchies acceptées. |
| Saisie **position libre** : on peut écrire les lettres de la fin d'abord | Demande du 08/11/2026. Curseur par clic ou flèches. |
| Rattrapage des périodes passées non jouées, sans limite | Demande : « si on a raté le mot du jour car on ne s'est pas connecté, pouvoir le faire plus tard ». |
| Pas de limite au nombre d'aides | Le coût en points suffit à les freiner. |
| Score d'une partie **plancher à 0** | Demande : « au pire pour un jour score 0, pas négatif ». |

### 2.2 Vocabulaire

| Décision | Raison / historique |
|---|---|
| Dictionnaire de **validation** large (formes fléchies) | Il faut accepter tout mot français plausible de 8-10 lettres. |
| Dictionnaire = union **Lexique 3** (CC BY-SA 4.0) + **Dicollecte 7.5** (MPL-2.0) | Lexique seul était trop incomplet (« charmees » manquait). Dicollecte apporte les conjugaisons/pluriels. |
| ODS **écarté** | Licence de redistribution floue. |
| Wiktionnaire **écarté pour l'instant** | Couvrirait « giraffon », mais extraction et licence à valider. |
| Mots cibles = **mots connus mais pas faciles** | Demande du 08/11/2026 : « sans choisir des mots faciles, qu'ils ne soient pas rares et peu connus ». |
| Sélection : fréquence 2,5–60 par million, noms singuliers (masc/fem), verbes à l'infinitif, adjectifs masc singuliers | Assez fréquents pour être connus, assez rares pour ne pas être triviaux. |
| Exclusions : noms propres (majuscule), gentilés, participes présents/adjectifs verbaux, listes noires manuelles | Éviter « stalinien », « pleurant », « gigogne ». |
| **1 311 mots cibles**, cycle d'environ **655 jours** | Tient ~2 ans à 2 mots/jour. |
| Mots du jour figés dans la base à la première ouverture | Changer la liste ne modifie pas une partie déjà commencée. |
| Pas de mot avec tiret ou apostrophe | Contrainte « a-z uniquement » et simplicité de saisie. |

### 2.3 Comptes, score, classement

| Décision | Raison |
|---|---|
| Google OAuth obligatoire, tout compte Google accepté | Demande initiale. Pas de liste blanche. |
| Session = cookie HttpOnly signé HMAC (`SESSION_SECRET`), 30 jours | Pas de table de sessions, pas de dépendance. |
| Identité validée par le jeton Google (émetteur, audience, expiration) | Vérification côté serveur. |
| Score victoire = `100 − 10 × essais` | Demandé explicitement (remplace 10−essais puis 100−10×essais). 1 essai = 90 pts, 9 essais = 10 pts. |
| Coût aides : −2 par lettre exclue, −5 par lettre révélée | Demandé explicitement. |
| Score partie = `max(0, gain − aides)`, défaite = 0 | Plancher à 0 demandé. |
| Score joueur = **somme** des parties (pas moyenne) | Simple et cumulatif. Tri : score, puis victoires, puis moyenne d'essais. |
| Classement affiché en **« Prénom I. »** | Demande : ne montrer que prénom + initiale du nom. Appliqué côté serveur : le nom complet n'est jamais envoyé au client dans le classement. |
| Regroupement par **compte Google** (`sub`), pas par nom | Deux personnes homonymes ne doivent pas fusionner. |
| Colonne « essais moyens » **retirée** de l'affichage | Demande. Reste calculée pour départager les ex æquo. |
| Un joueur sans partie terminée n'apparaît pas au classement | Conséquence du calcul sur les parties. |

### 2.4 Interface

| Décision | Raison |
|---|---|
| Front HTML/CSS/JS **vanilla**, une seule page, servi par le backend | Demande : « language html + js ». Zéro build, zéro dépendance. |
| Thème sombre, palette rouge/jaune/gris | Convention SUTOM. |
| **Calendrier** de sélection (remplace la liste déroulante) | Demande du 14/11/2026. Deux barres par jour = matin / après-midi, couleur = statut (vert gagné, rouge perdu, orange en cours, gris à jouer). Jours futurs désactivés. |
| Grille : **6 lignes au départ**, extension jusqu'à 9 | Demande : moins de vide. Une ligne s'ajoute après chaque essai au-delà de 6. |
| Grille à **pleine largeur** d'écran, cases carrées | Demande du 08/11/2026. |
| **Zoom mobile désactivé** (`user-scalable=no`, `touch-action: manipulation`, select à 16px) | Zoom involontaire en fin de mot jugé désagréable. Accessibilité assumée comme non prioritaire. |
| Bouton **Valider** sous le clavier, à la largeur du clavier | Demandé. |
| Boutons **Tout effacer** (et touche Échap) | Demande : pouvoir vider ce qu'on a tapé. |
| Mode d'emploi dans une boîte de dialogue (bouton « ? ») | Demandé. |
| Ligne d'info « Mot du … / essais / mode dur » **supprimée** | Demandée en trop, jugée inutile. |
| **Nouveautés** (notes de version) sous le mode d'emploi, groupées par date | Demande du 14/11/2026 : l'historique des changements visible dans le « ? ». Dialogue limité à 85 % de la hauteur et défilant. |
| Messages de fin adaptés : « prochain mot à midi » ou « demain à minuit » | Cohérent avec les 2 périodes. |
| Aides avec **confirmation** avant dépense | Éviter les clics involontaires. |
| Aide « donne une lettre » ne vend **jamais** une position déjà connue (rouge dans un essai ou déjà révélée) | Demandé : on payait pour une information déjà gratuite. |
| Aide « enlève une lettre » reste disponible tant qu'il existe des lettres absentes non exclues | Non protégé contre le déjà-connu ; à confirmer si besoin. |

### 2.5 Technique et exploitation

| Décision | Raison |
|---|---|
| Backend **Node.js 24 sans aucune dépendance npm** (`node:sqlite` natif, `fetch`) | Robustesse, image minuscule, pas de supply chain. |
| **SQLite** fichier dans un volume Docker | Suffisant pour un usage familial mono-instance. |
| **Pas de CI** : `git pull` + `docker compose up -d --build` sur ociub | Choisi explicitement. Image construite nativement en ARM64 sur le serveur. |
| Conteneur non-root (`USER node`) | Hygiène. |
| Réseau Docker externe `guacamole_internal` + Caddy existant | Modèle des autres apps d'ociub (mybooks, topps…). |
| **Caddy** existant du stack guacamole, bloc `sutom.laurans.org` en fin de `/app/guacamole/Caddyfile` | Pas de nouveau proxy. |
| Sauvegarde SQLite quotidienne (`keinos/sqlite3`), rétention 14 jours | Copie `.backup`, sans arrêt de service. |
| Dates en **Europe/Paris** via `Intl`, clés `AAAA-MM-JJ-am|pm` | Gère le changement d'heure sans dépendance. |
| Tables créées au démarrage + **migration automatique** (colonne `aides`, anciennes dates → `-am`) | Déploiement sans étape manuelle. |

## 3. Emplacements

| Quoi | Où |
|---|---|
| Dépôt local de dev | `/home/dieu/sutom` |
| Dépôt sur le serveur | `/app/sutom` (clone GitHub, `origin` = GitHub) |
| Secrets | `/app/sutom/.env` (600, non versionné) |
| Conteneur app | `sutom` (service `sutom`) |
| Conteneur sauvegarde | `sutom-backup-1` |
| Données SQLite | volume `sutom_sutom_data` → `/data/sutom.db` |
| Sauvegardes | volume `sutom_sutom_backups` (14 jours) |
| Proxy | `guacamole-caddy-1`, `/app/guacamole/Caddyfile` |
| Sauvegarde Caddyfile avant ajout | `/app/guacamole/Caddyfile.bak-sutom` |

## 4. Architecture

- **`src/jeu.js`** : logique pure et testable — `normaliser`, `score` (couleurs avec gestion des doublons), `jourParis`, `clePeriode`, `indexJour`, `cleDeIndex`, `motDuJour`.
- **`src/serveur.js`** : serveur HTTP natif, OAuth Google, cookies signés, API JSON, SQLite, classement, migrations.
- **`public/`** : `index.html` (page unique + 2 `<dialog>` : calendrier, mode d'emploi), `app.js` (état front, grille, clavier, curseur, aides, calendrier), `style.css` (thème sombre, responsive, media query < 480 px).
- **`data/`** : dictionnaire de validation, liste des mots cibles, licence des données.
- **Pas de framework, pas de bundler, pas de node_modules en production.**

### Fichiers

```
src/jeu.js            règles pures (testées)
src/serveur.js        HTTP, auth, API, SQLite, classement
public/index.html     page unique : jeu, classement, calendrier, mode d'emploi
public/app.js         logique front : saisie positionnelle, aides, calendrier
public/style.css      thème sombre + responsive + anti-zoom
test/jeu.test.js      tests unitaires node:test (4 tests)
data/dictionnaire.txt    178 855 formes de 8-10 lettres
data/mots-du-jour.txt    1 311 mots cibles
data/LICENCE.md          licences et pièges de régénération
regles.md                règles et cahier des charges
Dockerfile               node:24-alpine, USER node, /data
docker-compose.yml       sutom + backup, réseau guacamole_internal
.env.example             noms des variables
```

## 5. Variables d'environnement

Dans `/app/sutom/.env` (jamais commité) :

- `GOOGLE_CLIENT_ID` — identifiant OAuth (public mais à ne pas diffuser inutilement).
- `GOOGLE_CLIENT_SECRET` — **secret**. Ne jamais commiter ni coller dans un chat.
- `SESSION_SECRET` — clé HMAC des cookies ; changer la valeur déconnecte tout le monde.

Dans `docker-compose.yml` : `PORT=3000`, `APP_BASE_URL=https://sutom.laurans.org`, `DATA_DIR=/data`.

Client OAuth Google — URIs à déclarer :

- Origine JavaScript : `https://sutom.laurans.org`
- Redirection : `https://sutom.laurans.org/auth/google/callback`

## 6. Modèle de données

- `joueurs(sub PK, nom)` : `sub` = identifiant Google stable, `nom` = nom affiché Google.
- `parties(sub, jour, mot, essais, statut, aides, PK(sub, jour))`
  - `jour` : `AAAA-MM-JJ-am` (minuit→midi) ou `AAAA-MM-JJ-pm` (midi→minuit). Une date seule est encore acceptée et traitée comme `-am`.
  - `mot` : mot cible **figé** à la création de la partie.
  - `essais` : JSON `["mot1","mot2",…]`.
  - `statut` : `en_cours` | `gagnee` | `perdue`.
  - `aides` : JSON `{"exclues":["x"],"revelees":[{"position":3,"lettre":"r"}]}`.

Migrations automatiques au démarrage : ajout de `aides` si absente ; `UPDATE parties SET jour = jour || '-am' WHERE length(jour)=10`.

## 7. Score (formules exactes)

```
gain_partie   = gagnee ? 100 - 10 * nb_essais : 0
cout_aides    = 2 * nb_lettres_exclues + 5 * nb_lettres_revelees
points_partie = max(0, gain_partie - cout_aides)
score_joueur  = somme(points_partie) sur toutes ses parties terminées
```

Tri du classement : `score` desc, puis `victoires` desc, puis `moyenne_essais` asc.
Séries : calculées sur les périodes consécutives (`indexJour`), affichées mais **hors score**.

## 8. API

Cookie `sutom_session` requis sur toutes les routes `/api/*` sauf `/api/me`.

| Méthode | Route | Corps / paramètres | Rôle |
|---|---|---|---|
| GET | `/api/me` | — | Nom du joueur (401 sinon) |
| GET | `/api/jours` | — | `{aujourdhui, jours:[{cle,statut}]}` depuis `DATE_DEBUT` |
| GET | `/api/partie?jour=CLE` | — | État de la partie ; le mot n'est révélé qu'une fois terminée |
| POST | `/api/essai` | `{jour, mot}` | Ajoute un essai, renvoie l'état |
| POST | `/api/aide` | `{jour, type:"exclure"\|"reveler"}` | Consomme une aide |
| GET | `/api/classement` | — | `{joueurs:[…]}` |
| GET | `/healthz` | — | `{"ok":true}` |
| GET | `/auth/google` | — | Démarre l'OAuth (state en cookie) |
| GET | `/auth/google/callback` | `code,state` | Vérifie l'identité, crée le joueur, pose la session |
| POST | `/auth/deconnexion` | — | Efface le cookie |

Erreurs : JSON `{erreur}` avec code 400 (entrée invalide), 401 (non connecté), 404, 409 (partie finie / aide épuisée), 500.

## 9. Procédures

### Développer et tester

```bash
cd /home/dieu/sutom
npm test                      # 4 tests unitaires (node:test)
node --check src/serveur.js public/app.js
```

### Lancer en local

```bash
export APP_BASE_URL=http://localhost:3000 \
       GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> \
       SESSION_SECRET=$(openssl rand -hex 32) DATA_DIR=/tmp/sutom-dev
npm start
```

Pour tester sans Google : forger un cookie avec le même HMAC que `SESSION_SECRET` (voir `lireJeton`), payload `{sub,nom,exp}`.

### Déployer

```bash
git push origin main                       # sur la machine de dev
ssh ociub 'cd /app/sutom && git pull && docker compose up -d --build'
curl -s -o /dev/null -w "%{http_code}\n" https://sutom.laurans.org/healthz
```

### Restaurer une sauvegarde

```bash
ssh ociub
docker compose -f /app/sutom/docker-compose.yml stop sutom
# copier le fichier voulu de /var/lib/docker/volumes/sutom_sutom_backups/_data vers sutom_sutom_data/_data/sutom.db
docker compose -f /app/sutom/docker-compose.yml start sutom
```

### Modifier Caddy

Le Caddyfile est monté fichier par fichier : éditer avec `tee`/`cat >`, **pas** `sed -i` (l'inode changerait et le conteneur ne verrait pas la modif).

```bash
docker exec guacamole-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec guacamole-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 10. Régénérer les données

Sources :

- **Lexique 3** : `http://www.lexique.org/databases/Lexique383/Lexique383.zip` → `Lexique383.tsv` (CC BY-SA 4.0).
- **Dicollecte 7.5** : `npm pack dictionary-fr` → `index.dic` + `index.aff` (MPL-2.0), à développer avec `unmunch index.dic index.aff`.

Pipeline dictionnaire de validation :

1. `unmunch` sur Dicollecte.
2. **Couper chaque ligne au premier `/`** (les drapeaux Hunspell survivent sur ~1 ligne sur 13 ; sans ça 111 000 formes sont perdues — bug corrigé après coup).
3. Normaliser NFD, retirer les diacritiques, minuscules.
4. Garder `^[a-z]{8,10}$`, exclure les entrées dont l'orthographe commence par une majuscule (noms propres).
5. Union avec les formes Lexique 3 filtrées de la même façon.

Pipeline mots cibles (Lexique 3) :

1. Filtrer `2.5 <= freqlivres <= 60` et `freqfilms2 < 8`.
2. Garder noms singuliers (masc/fem), verbes à l'infinitif (`infover` vide, lemme = ortho), adjectifs masc singuliers non participes (`not endswith ant|ent`, pas aussi verbe).
3. Exiger `deflem` non vide ; exclure listes noires (gentilés, noms propres).
4. Mélange déterministe (`random.Random(<graine>)`), écrire un mot par ligne.

Ces scripts vivaient dans `/tmp/opencode/fr` et **ne sont pas dans le dépôt** : les recréer depuis cette description (ou les ajouter dans `scripts/`).

## 11. Points ouverts

- **Secret OAuth à régénérer** : le secret a circulé dans une conversation. À refaire dans Google Cloud Console, puis mettre à jour `.env` et redémarrer.
- **Relecture de `mots-du-jour.txt`** : les filtres automatiques peuvent laisser passer des jargons. À relire à l'usage ; retirer les mauvais mots et compléter.
- **Couverture lexicale** : Dicollecte + Lexique ne couvrent pas tout (« giraffon » absent). Option : extraire le Wiktionnaire FR (CC BY-SA) et fusionner.
- **Aide « enlève une lettre »** : peut encore vendre une lettre déjà connue grise. Décider si on applique la même protection que pour « donne une lettre ».
- **Test mobile réel** : la mise en page (< 480 px), le calendrier tactile et le curseur n'ont été vérifiés qu'en CSS/lecture.
- **Périodes historiques fictives** : le passage à 2 mots/jour crée des périodes « après-midi » rétroactives depuis le 18/10/2026, rattrapables. À masquer si jugé gênant.
- **Pas d'admin** : correction manuelle en SQLite uniquement.
- **Droits GitHub** : un jeton `gh` sans scope d'écriture provoque un 403 au push.
- **Mono-instance** : SQLite fichier ; pas de scaling horizontal, pas de mode hors ligne.
- **Accessibilité** : zoom navigateur volontairement désactivé (choix assumé).

## 12. Journal des changements notables

1. Création du jeu : 1 mot/jour, 8-10 lettres, 9 essais, mode dur avec réutilisation des lettres.
2. Suppression de la contrainte de réutilisation ; ajout de « Tout effacer » ; mots cibles rendus rares.
3. Rattrapage des jours manqués ; sélecteur de jour.
4. Bouton Valider ; largeur des boutons calée sur le clavier.
5. Score basé sur les essais (10−essais), puis 100−10×essais ; plancher à 0.
6. Aides payantes (lettre exclue −2, lettre révélée −5) + mode d'emploi ; migration `aides`.
7. Suppression de la ligne d'info ; responsive petit écran.
8. Sélecteur déplacé dans l'en-tête, dates en jj-mm ; grille 6 lignes extensible ; colonne essais moyens retirée ; noms en « Prénom I. ».
9. Dictionnaire élargi à 178 855 formes (correction du bug de drapeaux `unmunch`).
10. Passage à **2 mots par jour** (périodes `-am`/`-pm`, migration des anciennes parties).
11. Mots cibles rendus **connus mais non triviaux** (1 311 mots, fréquence 2,5–60).
12. Lettres rouges reportées en rouge sur la ligne suivante, remplaçables.
13. Aide « donne une lettre » ne vend plus de position déjà connue.
14. Calendrier avec choix matin / après-midi.
15. En-tête : le bouton du jour n'hérite plus du style rond du « ? » — le libellé « Mot du 14-11 après-midi » redevient lisible (il était écrasé à 2 rem et masqué).
16. Notes de version « Nouveautés » ajoutées sous le mode d'emploi (« ? »), groupées par date ; dialogue défilant à 85 % de la hauteur.
