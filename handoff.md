# Handoff : SUTOM en français

Document de reprise. Aucun secret n'est écrit ici : les valeurs sensibles sont uniquement dans `/app/sutom/.env` sur ociub.

## En bref

- Jeu SUTOM en français : un mot par jour, 8 à 10 lettres, 9 essais, mode dur.
- Connexion Google OAuth, ouverte à tout compte Google.
- Classement global, avec score, victoires, série, meilleure série.
- Rattrapage possible : un joueur peut rejouer n'importe quel jour passé non joué.
- En production : https://sutom.laurans.org (ociub, Oracle Cloud ARM64).
- Dépôt public : https://github.com/blaurans/sutom (branche `main`).
- Dernier commit en prod : voir `git log -1` (le déploiement se fait à partir de `main`).

## Emplacements

| Quoi | Où |
|---|---|
| Dépôt local (machine de dev) | `/home/dieu/sutom` |
| Dépôt sur le serveur | `/app/sutom` (clone de GitHub, `origin` = GitHub) |
| Secrets | `/app/sutom/.env` (mode 600, non versionné) |
| Conteneur app | `sutom` (service `sutom` dans `docker-compose.yml`) |
| Conteneur sauvegarde | `sutom-backup-1` |
| Volume données SQLite | `sutom_sutom_data` (monté sur `/data`, fichier `sutom.db`) |
| Volume sauvegardes | `sutom_sutom_backups` (copies quotidiennes, 14 jours) |
| Proxy | `guacamole-caddy-1`, fichier `/app/guacamole/Caddyfile` |
| Sauvegarde du Caddyfile avant modif | `/app/guacamole/Caddyfile.bak-sutom` |

## Architecture

- **Backend** : Node.js 24, sans dépendance npm. Module natif `node:sqlite`. Fichier : `src/serveur.js`.
- **Logique de jeu pure** : `src/jeu.js` (normalisation, scoring des couleurs, date Paris, mot du jour).
- **Front** : HTML, CSS et JS vanilla, servi par le même serveur (`public/`).
- **Données** : `data/dictionnaire.txt` (validation des propositions) et `data/mots-du-jour.txt` (mots cibles).
- **Réseau Docker** : réseau externe `guacamole_internal`, rejoint aussi par Caddy. Caddy relaie `sutom.laurans.org` vers `sutom:3000`.
- **Healthcheck** : `GET /healthz` renvoie `{"ok":true}`.

### Fichiers principaux

```
src/jeu.js          règles pures : score, normaliser, indexJour, motDuJour, jourParis
src/serveur.js      HTTP, OAuth Google, API, SQLite, classement
public/index.html   page unique (connexion, jeu, classement, mode d'emploi)
public/app.js       logique front (saisie positionnelle, aides, appels API)
public/style.css    thème sombre, mise en page, media query < 480 px
test/jeu.test.js    tests unitaires (node:test)
data/LICENCE.md     licence des données (CC BY-SA 4.0, Lexique 3)
regles.md           règles et cahier des charges fonctionnels
Dockerfile          image node:24-alpine, utilisateur node, /data
docker-compose.yml  services sutom + backup, réseau externe guacamole_internal
.env.example        noms des variables (sans valeurs)
```

## Variables d'environnement

Définies dans `/app/sutom/.env`, lues par `src/serveur.js` :

- `GOOGLE_CLIENT_ID` : identifiant du client OAuth (non secret, mais ne pas le diffuser inutilement).
- `GOOGLE_CLIENT_SECRET` : secret OAuth. **Ne jamais le commiter.**
- `SESSION_SECRET` : clé HMAC des cookies de session. Généré sur le serveur. Changer cette valeur déconnecte tous les joueurs.

Définies dans `docker-compose.yml` :

- `PORT=3000`
- `APP_BASE_URL=https://sutom.laurans.org`
- `DATA_DIR=/data`

Dans le client OAuth Google, les URI suivantes doivent être enregistrées :

- Origine JavaScript : `https://sutom.laurans.org`
- Redirection : `https://sutom.laurans.org/auth/google/callback`

## Base de données

Fichier `sutom.db` (SQLite) :

- `joueurs(sub PRIMARY KEY, nom)` : `sub` = identifiant Google, `nom` = nom affiché Google.
- `parties(sub, jour, mot, essais, statut, aides, PRIMARY KEY(sub, jour))`
  - `jour` au format `AAAA-MM-JJ` (fuseau Europe/Paris).
  - `mot` : mot cible figé à la création de la partie.
  - `essais` : tableau JSON des propositions.
  - `statut` : `en_cours`, `gagnee` ou `perdue`.
  - `aides` : JSON `{"exclues": [...], "revelees": [{"position", "lettre"}]}`.
- Migration automatique : la colonne `aides` est ajoutée au démarrage si elle manque.

## Règles (résumé, détail dans regles.md)

- Mot du jour : 8 à 10 lettres, 9 essais, première lettre donnée.
- Couleurs : rouge (bien placée), jaune (présente ailleurs), gris (absente). Pas de contrainte de réutilisation.
- Saisie sans accents. Formes fléchies acceptées (dictionnaire Lexique 3).
- Jour de référence : `DATE_DEBUT = 2026-10-18` dans `src/jeu.js`. Le mot du jour est `motsDuJour[indexJour % 400]` (cycle de 400 jours).
- Rattrapage : `GET /api/partie?jour=` et `POST /api/essai` acceptent tout jour entre `DATE_DEBUT` et aujourd'hui. Un jour sans partie est créé à la première consultation.

### Score

- Victoire : `100 − 10 × essais`.
- Aide « Enlève une lettre » : −2 pts. Retire du clavier une lettre absente du mot.
- Aide « Donne une lettre » : −5 pts. Révèle une lettre à sa bonne place (jamais la première).
- Score d'une partie : `max(0, gain − coût des aides)`. Défaite : 0.
- Score d'un joueur : total de ses parties. Tri : score, puis victoires, puis moyenne d'essais.

## API

Toutes les routes `/api/*` (sauf `/api/me`) exigent le cookie `sutom_session`.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/me` | Nom du joueur connecté (401 sinon) |
| GET | `/api/jours` | Liste des jours depuis `DATE_DEBUT` jusqu'à aujourd'hui, avec statut |
| GET | `/api/partie?jour=` | État d'une partie (sans le mot tant qu'elle est en cours) |
| POST | `/api/essai` | Corps `{jour, mot}` |
| POST | `/api/aide` | Corps `{jour, type: "exclure" \| "reveler"}` |
| GET | `/api/classement` | Classement |
| GET | `/healthz` | Santé du service |
| GET | `/auth/google` | Démarre la connexion |
| GET | `/auth/google/callback` | Retour OAuth |
| POST | `/auth/deconnexion` | Déconnexion |

## Déploiement

Sur la machine de dev, commit et push :

```bash
cd /home/dieu/sutom
git add -A && git commit -m "..." && git push origin main
```

Sur ociub, mise à jour :

```bash
ssh ociub 'cd /app/sutom && git pull && docker compose up -d --build'
```

Vérification :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sutom.laurans.org/healthz
```

Tests en local :

```bash
cd /home/dieu/sutom && npm test
```

Lancer le serveur en local (à adapter, les valeurs sont à fournir par soi-même) :

```bash
export APP_BASE_URL=http://localhost:3000 GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... SESSION_SECRET=$(openssl rand -hex 32) DATA_DIR=/tmp/sutom-dev
npm start
```

Sauvegarde : le conteneur `sutom-backup-1` copie `sutom.db` chaque jour dans `sutom_sutom_backups` (rotation 14 jours). Restaurer : copier un fichier `sutom-*.db` vers `/data/sutom.db` du volume, conteneur arrêté.

## Caddy

Bloc ajouté en fin de `/app/guacamole/Caddyfile` :

```
sutom.laurans.org {
    encode zstd gzip
    header { ... }
    reverse_proxy sutom:3000
    log { ... /data/sutom-access.log ... }
}
```

Le fichier est monté en bind sur un seul fichier : le modifier avec `tee` ou `cat >` (pas `sed -i`, qui change l'inode). Valider puis recharger :

```bash
docker exec guacamole-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec guacamole-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## Données et licences

- `data/dictionnaire.txt` : 54 039 formes de 8 à 10 lettres, issues de Lexique 3 (normalisées : minuscules, sans accents, a-z).
- `data/mots-du-jour.txt` : 400 lemmes rares (fréquence littéraire entre 0,5 et 4 par million), filtrés automatiquement puis retouchés à la main.
- Licence : CC BY-SA 4.0 (Lexique 3). Voir `data/LICENCE.md`. Le dépôt `package.json` est sous MIT pour le code.
- ODS (dictionnaire Officiel du Scrabble) : **non intégré**. Sa licence de redistribution est à clarifier avant d'être ajouté.

Pour régénérer les listes, les scripts Python ont été lancés depuis `/tmp/opencode/sutom` (fichier `Lexique383.tsv`, téléchargé depuis lexique.org). Ils ne sont pas dans le dépôt : à ajouter dans `scripts/` si la régénération doit être reproductible.

## Points ouverts

- **Secret OAuth exposé** : le `GOOGLE_CLIENT_SECRET` a été collé dans une conversation. Le régénérer dans Google Cloud Console, mettre à jour `/app/sutom/.env`, puis `docker compose up -d`.
- **Relecture de `data/mots-du-jour.txt`** : les filtres automatiques laissent passer des mots douteux (participes, gentilés, mots obscurs). Une relecture humaine est nécessaire avant d'ouvrir le jeu à la famille. Corriger le fichier, commit, déploiement.
- **Test sur téléphone** : la mise en page petits écrans (< 480 px) n'a été vérifiée que par lecture du CSS.
- **Droits GitHub** : un jeton `gh` peut ne pas avoir l'accès en écriture sur `blaurans/sutom`. Vérifier avant un push (`git push` en 403 = permission).
- **Classement** : un joueur qui se connecte puis ne joue jamais n'apparaît pas. Le nom est affiché sous la forme « Prénom I. ».
- **Rattrapage illimité** : tout jour passé non joué est jouable, sans limite à la période de connexion. À confirmer.
- **Pas d'admin** : aucune interface pour corriger une partie ou un joueur. Passer par SQLite si besoin.
- **Hors ligne** : aucun mode hors ligne ni cache côté client.
- **Une seule instance** : SQLite en fichier, une seule instance du conteneur. Ne pas scaler horizontalement.

## Historique des décisions

- Dictionnaire : Lexique 3 seul (ODS écarté pour raisons de licence).
- Authentification : OAuth Google en code flow, validation de l'identité via le jeton renvoyé par Google sur le canal TLS.
- Mode dur : première lettre imposée, couleurs comme indices. La contrainte de réutilisation des lettres a été retirée à la demande.
- Déploiement : build direct sur ociub, pas de CI.
- Classement : score total (somme des parties), affiché avec prénom et initiale du nom.
