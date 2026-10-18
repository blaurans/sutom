# SUTOM FR : règles et cahier des charges

Dépôt : https://github.com/blaurans/sutom (public)
URL : https://sutom.laurans.org
Hébergement : ociub (Oracle Cloud, aarch64), dossier `/app/sutom`

## Règles du jeu

- **Un nouveau mot par jour**, changement à minuit (Europe/Paris).
- Le mot est tiré dans une **liste curée et ordonnée** (un mot par jour, dans l'ordre).
- Longueur du mot : **de 8 à 10 lettres** (variable selon le jour).
- **9 essais** maximum.
- La **première lettre est donnée** et ne change pas.
- Couleurs après chaque essai :
  - rouge : lettre bien placée
  - jaune : lettre présente dans le mot mais mal placée
  - gris : lettre absente
- Saisie **sans accents** (É → E, Ç → C). Les accents sont ignorés pour la comparaison.
- Formes fléchies acceptées : conjugaisons, pluriels, féminins.

### Mode dur

- La première lettre reste imposée.
- Les couleurs indiquent les lettres bien placées (rouge) et mal placées (jaune) : aucune contrainte de réutilisation n'est imposée au joueur.
- La difficulté vient de la rareté du mot du jour, pas de contraintes sur les essais.

### Saisie

- Retour arrière (⌫) : efface la dernière lettre.
- Échap ou « Tout effacer » : efface toute la saisie de la ligne en cours.

## Dictionnaire

- Union de **Lexique 3** (mots courants, fréquences) et **ODS** (exhaustivité).
- Filtrage : lettres A-Z uniquement (sans tiret ni apostrophe), longueur 8 à 10, sans accents, sans majuscules.
- Le dictionnaire de **validation** (mots acceptés en proposition) est large.
- La **liste des mots du jour** est volontairement rare : lemmes de fréquence littéraire entre 0,5 et 4 occurrences par million (Lexique 3), noms masculins singuliers, verbes à l'infinitif et adjectifs masculins singuliers, sans noms propres ni gentilés. Elle doit être relue manuellement.
- Points à valider : licences de redistribution (Lexique 3 est CC BY-SA 4.0, ODS à vérifier).

## Comptes et classement

- Connexion **Google OAuth**, ouverte à tout compte Google.
- Classement **global**, visible par tous les joueurs connectés.
- Affichage : **nom affiché Google uniquement**, jamais l'adresse e-mail.
- Stats par joueur : parties jouées, victoires, % de victoires, série en cours, meilleure série, nombre moyen d'essais.
- **Score** (colonne principale du classement) : une victoire rapporte `100 − 10 × nombre d'essais` points (1 essai = 90 pts, 9 essais = 10 pts). Une défaite rapporte 0. Les aides retirent leur coût (voir ci-dessous) dans tous les cas. Le score d'un joueur est le total de ses points sur toutes les parties.
- Tri du classement : score, puis victoires, puis nombre moyen d'essais.

### Aides

- **Enlève une lettre** (−2 pts) : retire du clavier une lettre qui n'est pas dans le mot. Utilisable plusieurs fois tant qu'il reste de telles lettres.
- **Donne une lettre** (−5 pts) : révèle une lettre à sa bonne place (jamais la première, déjà donnée). Utilisable plusieurs fois.
- Les aides ne sont disponibles que pendant la partie en cours. Elles sont enregistrées et comptées dans le score.

## Architecture technique

- **Front** : HTML + JS (vanilla), statique, servi par le backend.
- **Backend** : Node.js ou Python (léger).
  - Sert le front.
  - Vérifie le token Google côté serveur.
  - Expose l'API de partie et de classement.
- **Stockage** : SQLite dans un volume Docker (`sutom_data`), sauvegarde quotidienne comme `mybooks`.
- **Réseau** : rejoint le réseau Docker externe `guacamole_internal`, comme les autres apps d'ociub.
- **Proxy** : Caddy existant (`/app/guacamole/Caddyfile`). Ajout d'un bloc `sutom.laurans.org` pointant sur le conteneur de l'app.
- **Image** : construite sur ociub (`docker compose build`), native ARM64.

## Déploiement

- Dépôt cloné sur ociub dans `/app/sutom`.
- `git pull` puis `docker compose build && docker compose up -d` pour publier.
- Secrets dans `.env` sur le serveur, jamais dans le dépôt :
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `APP_BASE_URL=https://sutom.laurans.org`

## Configuration Google OAuth

- Créer un identifiant OAuth (type Application Web) dans Google Cloud Console.
- URI de redirection autorisée : `https://sutom.laurans.org/auth/google/callback`
- Origine JavaScript autorisée : `https://sutom.laurans.org`

## Points ouverts

- [ ] Licences : valider la redistribution de Lexique 3 et de l'ODS avant publication sur GitHub.
- [ ] Liste des mots du jour : générer puis relire (au moins 365 mots).
- [ ] Proxy : confirmer l'ajout du bloc Caddy sur ociub (modification d'un fichier partagé).
- [ ] Identifiants Google OAuth : à créer et à fournir dans `.env` sur ociub.
