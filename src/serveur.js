import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  DATE_DEBUT,
  ESSAIS_MAX,
  indexJour,
  jourParis,
  motDuJour,
  normaliser,
  score,
} from './jeu.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RACINE, 'public');
const DUREE_SESSION_MS = 30 * 24 * 3600 * 1000;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const COUT_AIDE = { exclure: 2, reveler: 5 };
const AIDES_VIDES = '{"exclues":[],"revelees":[]}';

function requis(nom) {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return valeur;
}

const config = {
  port: Number(process.env.PORT || 3000),
  baseUrl: requis('APP_BASE_URL'),
  clientId: requis('GOOGLE_CLIENT_ID'),
  clientSecret: requis('GOOGLE_CLIENT_SECRET'),
  secret: requis('SESSION_SECRET'),
  dataDir: process.env.DATA_DIR || path.join(RACINE, 'var'),
};

const dictionnaire = new Set(
  fs.readFileSync(path.join(RACINE, 'data', 'dictionnaire.txt'), 'utf8').split('\n').filter(Boolean),
);
const motsDuJour = fs.readFileSync(path.join(RACINE, 'data', 'mots-du-jour.txt'), 'utf8').split('\n').filter(Boolean);

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new DatabaseSync(path.join(config.dataDir, 'sutom.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS joueurs (
    sub TEXT PRIMARY KEY,
    nom TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS parties (
    sub TEXT NOT NULL,
    jour TEXT NOT NULL,
    mot TEXT NOT NULL,
    essais TEXT NOT NULL DEFAULT '[]',
    statut TEXT NOT NULL DEFAULT 'en_cours',
    PRIMARY KEY (sub, jour)
  );
`);

if (!db.prepare('PRAGMA table_info(parties)').all().some((c) => c.name === 'aides')) {
  db.exec(`ALTER TABLE parties ADD COLUMN aides TEXT NOT NULL DEFAULT '${AIDES_VIDES}'`);
}

const securise = config.baseUrl.startsWith('https');

function signer(charge) {
  const corps = Buffer.from(JSON.stringify(charge)).toString('base64url');
  const signature = crypto.createHmac('sha256', config.secret).update(corps).digest('base64url');
  return `${corps}.${signature}`;
}

function lireJeton(jeton) {
  if (!jeton) return null;
  const [corps, signature] = jeton.split('.');
  if (!corps || !signature) return null;
  const attendue = crypto.createHmac('sha256', config.secret).update(corps).digest('base64url');
  if (signature.length !== attendue.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(attendue))) return null;
  const charge = JSON.parse(Buffer.from(corps, 'base64url').toString());
  if (charge.exp && charge.exp < Date.now()) return null;
  return charge;
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf('=');
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
      }),
  );
}

function cookie(nom, valeur, maxAge) {
  return `${nom}=${encodeURIComponent(valeur)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${securise ? '; Secure' : ''}`;
}

function envoyerJson(res, statut, donnees, entetes = {}) {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...entetes });
  res.end(JSON.stringify(donnees));
}

function rediriger(res, cible, entetes = {}) {
  res.writeHead(302, { Location: cible, ...entetes });
  res.end();
}

async function lireCorps(req) {
  let corps = '';
  for await (const morceau of req) {
    corps += morceau;
    if (corps.length > 10_000) throw new Error('Requête trop volumineuse');
  }
  return corps ? JSON.parse(corps) : {};
}

function sessionDepuis(req) {
  return lireJeton(cookies(req).sutom_session);
}

const requeteParties = {
  lire: db.prepare('SELECT mot, essais, statut, aides FROM parties WHERE sub = ? AND jour = ?'),
  creer: db.prepare("INSERT OR IGNORE INTO parties (sub, jour, mot) VALUES (?, ?, ?)"),
  maj: db.prepare('UPDATE parties SET essais = ?, statut = ? WHERE sub = ? AND jour = ?'),
  majAides: db.prepare('UPDATE parties SET aides = ? WHERE sub = ? AND jour = ?'),
  terminees: db.prepare(`
    SELECT j.nom, p.jour, p.statut, p.essais, p.aides
    FROM parties p JOIN joueurs j ON j.sub = p.sub
    WHERE p.statut != 'en_cours'
    ORDER BY p.jour
  `),
  tous: db.prepare('SELECT jour, statut FROM parties WHERE sub = ?'),
  upsertJoueur: db.prepare(`
    INSERT INTO joueurs (sub, nom) VALUES (?, ?)
    ON CONFLICT(sub) DO UPDATE SET nom = excluded.nom
  `),
};

function jourValide(jour) {
  return typeof jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jour) && jour >= DATE_DEBUT && jour <= jourParis();
}

function listerJours(sub) {
  const aujourdhui = jourParis();
  const statuts = new Map(requeteParties.tous.all(sub).map((l) => [l.jour, l.statut]));
  const jours = [];
  const [a, m, d] = DATE_DEBUT.split('-').map(Number);
  for (let t = Date.UTC(a, m - 1, d); ; t += 86400000) {
    const jour = new Date(t).toISOString().slice(0, 10);
    if (jour > aujourdhui) break;
    jours.push({ jour, statut: statuts.get(jour) ?? null });
  }
  return { aujourdhui, jours: jours.reverse() };
}

function etatPartie(sub, jour) {
  let partie = requeteParties.lire.get(sub, jour);
  if (!partie) {
    requeteParties.creer.run(sub, jour, motDuJour(jour, motsDuJour));
    partie = requeteParties.lire.get(sub, jour);
  }
  const essais = JSON.parse(partie.essais);
  return {
    jour,
    longueur: partie.mot.length,
    premiereLettre: partie.mot[0],
    essaisMax: ESSAIS_MAX,
    essais: essais.map((mot) => ({ mot, resultat: score(mot, partie.mot) })),
    aides: JSON.parse(partie.aides),
    statut: partie.statut,
    mot: partie.statut === 'en_cours' ? undefined : partie.mot,
  };
}

function utiliserAide(sub, jour, type) {
  if (!jourValide(jour)) return { erreur: 400, message: 'Jour invalide.' };
  if (!COUT_AIDE[type]) return { erreur: 400, message: 'Aide inconnue.' };
  const partie = requeteParties.lire.get(sub, jour);
  if (!partie) return { erreur: 404, message: 'Partie introuvable.' };
  if (partie.statut !== 'en_cours') return { erreur: 409, message: 'La partie est terminée.' };

  const aides = JSON.parse(partie.aides);
  const cible = partie.mot;

  if (type === 'exclure') {
    const candidates = [...ALPHABET].filter((l) => !cible.includes(l) && !aides.exclues.includes(l));
    if (!candidates.length) return { erreur: 409, message: 'Plus aucune lettre à retirer.' };
    aides.exclues.push(candidates[crypto.randomInt(candidates.length)]);
  } else {
    const positions = [...cible].map((_, i) => i).filter((i) => i > 0 && !aides.revelees.some((r) => r.position === i));
    if (!positions.length) return { erreur: 409, message: 'Toutes les lettres sont déjà révélées.' };
    const position = positions[crypto.randomInt(positions.length)];
    aides.revelees.push({ position, lettre: cible[position] });
  }

  requeteParties.majAides.run(JSON.stringify(aides), sub, jour);
  return { etat: etatPartie(sub, jour) };
}

function coutAides(aides) {
  return aides.exclues.length * COUT_AIDE.exclure + aides.revelees.length * COUT_AIDE.reveler;
}

function ajouterEssai(sub, jour, brut) {
  if (!jourValide(jour)) return { erreur: 400, message: 'Jour invalide.' };
  const partie = requeteParties.lire.get(sub, jour);
  if (!partie) return { erreur: 404, message: 'Partie introuvable.' };
  if (partie.statut !== 'en_cours') return { erreur: 409, message: 'La partie est terminée.' };

  const essais = JSON.parse(partie.essais);
  const mot = normaliser(String(brut ?? ''));
  const cible = partie.mot;

  if (essais.length >= ESSAIS_MAX) return { erreur: 409, message: 'Plus d\'essais disponibles.' };
  if (mot.length !== cible.length) return { erreur: 400, message: `Le mot doit contenir ${cible.length} lettres.` };
  if (mot[0] !== cible[0]) return { erreur: 400, message: `Le mot doit commencer par ${cible[0].toUpperCase()}.` };
  if (!dictionnaire.has(mot)) return { erreur: 400, message: 'Mot absent du dictionnaire.' };
  if (essais.includes(mot)) return { erreur: 400, message: 'Mot déjà proposé.' };

  essais.push(mot);
  let statut = 'en_cours';
  if (mot === cible) statut = 'gagnee';
  else if (essais.length >= ESSAIS_MAX) statut = 'perdue';
  requeteParties.maj.run(JSON.stringify(essais), statut, sub, jour);
  return { etat: etatPartie(sub, jour) };
}

function calculerClassement() {
  const joueurs = new Map();
  for (const ligne of requeteParties.terminees.all()) {
    const essais = JSON.parse(ligne.essais);
    const joueur = joueurs.get(ligne.nom) || { nom: ligne.nom, parties: [] };
    const gagnee = ligne.statut === 'gagnee';
    const points = (gagnee ? 100 - 10 * essais.length : 0) - coutAides(JSON.parse(ligne.aides));
    joueur.parties.push({ jour: indexJour(ligne.jour), gagnee, essais: essais.length, points });
    joueurs.set(ligne.nom, joueur);
  }
  const aujourd = indexJour(jourParis());
  return [...joueurs.values()]
    .map(({ nom, parties }) => {
      const victoires = parties.filter((p) => p.gagnee);
      let serie = 0;
      let meilleure = 0;
      let precedent = null;
      for (const p of parties) {
        const suite = precedent !== null && p.jour === precedent + 1;
        serie = p.gagnee ? (suite ? serie + 1 : 1) : 0;
        meilleure = Math.max(meilleure, serie);
        precedent = p.jour;
      }
      const dernier = parties[parties.length - 1];
      const serieActive = dernier && dernier.gagnee && aujourd - dernier.jour <= 1 ? serie : 0;
      const moyenne = victoires.length
        ? Math.round((victoires.reduce((s, p) => s + p.essais, 0) / victoires.length) * 10) / 10
        : null;
      const score = parties.reduce((s, p) => s + p.points, 0);
      return {
        nom,
        score,
        joues: parties.length,
        victoires: victoires.length,
        pourcentage: Math.round((victoires.length / parties.length) * 100),
        serie: serieActive,
        meilleureSerie: meilleure,
        moyenneEssais: moyenne,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.victoires - a.victoires ||
        (a.moyenneEssais ?? 99) - (b.moyenneEssais ?? 99),
    );
}

async function routeApi(req, res, url) {
  if (url.pathname === '/api/me') {
    const session = sessionDepuis(req);
    if (!session) return envoyerJson(res, 401, { erreur: 'Non connecté.' });
    return envoyerJson(res, 200, { nom: session.nom });
  }

  if (url.pathname === '/api/classement' && req.method === 'GET') {
    if (!sessionDepuis(req)) return envoyerJson(res, 401, { erreur: 'Non connecté.' });
    return envoyerJson(res, 200, { joueurs: calculerClassement() });
  }

  const session = sessionDepuis(req);
  if (!session) return envoyerJson(res, 401, { erreur: 'Non connecté.' });

  if (url.pathname === '/api/jours' && req.method === 'GET') {
    return envoyerJson(res, 200, listerJours(session.sub));
  }

  if (url.pathname === '/api/partie' && req.method === 'GET') {
    const jour = url.searchParams.get('jour') || jourParis();
    if (!jourValide(jour)) return envoyerJson(res, 400, { erreur: 'Jour invalide.' });
    return envoyerJson(res, 200, etatPartie(session.sub, jour));
  }

  if (url.pathname === '/api/aide' && req.method === 'POST') {
    const corps = await lireCorps(req);
    const resultat = utiliserAide(session.sub, corps.jour, corps.type);
    if (resultat.erreur) return envoyerJson(res, resultat.erreur, { erreur: resultat.message });
    return envoyerJson(res, 200, resultat.etat);
  }

  if (url.pathname === '/api/essai' && req.method === 'POST') {
    if (!String(req.headers['content-type'] || '').includes('application/json')) {
      return envoyerJson(res, 415, { erreur: 'JSON attendu.' });
    }
    const corps = await lireCorps(req);
    const resultat = ajouterEssai(session.sub, corps.jour, corps.mot);
    if (resultat.erreur) return envoyerJson(res, resultat.erreur, { erreur: resultat.message });
    return envoyerJson(res, 200, resultat.etat);
  }

  return envoyerJson(res, 404, { erreur: 'Introuvable.' });
}

async function routeAuth(req, res, url) {
  const redirectUri = `${config.baseUrl}/auth/google/callback`;

  if (url.pathname === '/auth/google') {
    const etat = crypto.randomBytes(16).toString('base64url');
    const cible = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    cible.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state: etat,
      prompt: 'select_account',
    }).toString();
    return rediriger(res, cible.toString(), { 'Set-Cookie': cookie('sutom_etat', etat, 600) });
  }

  if (url.pathname === '/auth/google/callback') {
    const attendu = cookies(req).sutom_etat;
    const code = url.searchParams.get('code');
    if (!code || !attendu || url.searchParams.get('state') !== attendu) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Connexion refusée.');
    }

    const reponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!reponse.ok) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Échec de la connexion Google.');
    }
    const { id_token: jetonId } = await reponse.json();
    const identite = JSON.parse(Buffer.from(jetonId.split('.')[1], 'base64url').toString());
    const emetteurOk = ['https://accounts.google.com', 'accounts.google.com'].includes(identite.iss);
    if (!emetteurOk || identite.aud !== config.clientId || identite.exp * 1000 < Date.now()) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Jeton Google invalide.');
    }

    const nom = identite.name || identite.given_name || 'Joueur';
    requeteParties.upsertJoueur.run(identite.sub, nom);
    const session = signer({ sub: identite.sub, nom, exp: Date.now() + DUREE_SESSION_MS });
    return rediriger(res, '/', {
      'Set-Cookie': [cookie('sutom_session', session, DUREE_SESSION_MS / 1000), cookie('sutom_etat', '', 0)],
    });
  }

  if (url.pathname === '/auth/deconnexion' && req.method === 'POST') {
    return rediriger(res, '/', { 'Set-Cookie': cookie('sutom_session', '', 0) });
  }

  res.writeHead(404);
  res.end();
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function servirStatique(res, url) {
  const relatif = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const fichier = path.normalize(path.join(PUBLIC, relatif));
  if (!fichier.startsWith(PUBLIC + path.sep) || !fs.existsSync(fichier) || !fs.statSync(fichier).isFile()) {
    res.writeHead(404);
    return res.end('Introuvable');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
  });
  fs.createReadStream(fichier).pipe(res);
}

const serveur = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.baseUrl);
    if (url.pathname === '/healthz') return envoyerJson(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/')) return await routeApi(req, res, url);
    if (url.pathname.startsWith('/auth/')) return await routeAuth(req, res, url);
    return servirStatique(res, url);
  } catch (erreur) {
    console.error(erreur);
    if (!res.headersSent) envoyerJson(res, 500, { erreur: 'Erreur interne.' });
  }
});

serveur.listen(config.port, () => {
  console.log(`SUTOM en écoute sur le port ${config.port} (${dictionnaire.size} mots, ${motsDuJour.length} mots du jour)`);
});
