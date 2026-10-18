# SUTOM en français

Jeu SUTOM en français : un mot par jour, 8 à 10 lettres, 9 essais, mode dur.
Connexion Google OAuth, classement global.

En ligne : https://sutom.laurans.org

## Règles

Voir [regles.md](regles.md).

## Développement

```bash
npm test
export APP_BASE_URL=http://localhost:3000 GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... SESSION_SECRET=$(openssl rand -hex 32)
npm start
```

## Déploiement (ociub)

Le dépôt est cloné dans `/app/sutom`. Le fichier `.env` (secrets) reste sur le serveur et n'est jamais commité.

```bash
cd /app/sutom && git pull && docker compose up -d --build
```

## Données

Dictionnaire et mots du jour dérivés de Lexique 3 (CC BY-SA 4.0), voir [data/LICENCE.md](data/LICENCE.md).
