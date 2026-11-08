export const ESSAIS_MAX = 9;
export const DATE_DEBUT = '2026-10-18';

export function normaliser(texte) {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export function score(essai, cible) {
  const resultat = Array(cible.length).fill('absent');
  const restantes = {};
  for (let i = 0; i < cible.length; i++) {
    if (essai[i] === cible[i]) {
      resultat[i] = 'correct';
    } else {
      restantes[cible[i]] = (restantes[cible[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < cible.length; i++) {
    if (resultat[i] === 'correct') continue;
    if (restantes[essai[i]] > 0) {
      resultat[i] = 'present';
      restantes[essai[i]]--;
    }
  }
  return resultat;
}

export function jourParis(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Clé de la période en cours : 'AAAA-MM-JJ-am' (minuit à midi) ou 'pm' (midi à minuit).
export function clePeriode(date = new Date()) {
  const heure = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date),
  );
  return `${jourParis(date)}-${heure >= 12 ? 'pm' : 'am'}`;
}

// Index numérique d'une clé : 2 par jour (am puis pm). Une date seule compte comme 'am'.
export function indexJour(cle) {
  const jour = String(cle).slice(0, 10);
  const [annee, mois, jourDuMois] = jour.split('-').map(Number);
  const [a, m, d] = DATE_DEBUT.split('-').map(Number);
  if ([annee, mois, jourDuMois].some(Number.isNaN)) return NaN;
  const jours = Math.round((Date.UTC(annee, mois - 1, jourDuMois) - Date.UTC(a, m - 1, d)) / 86400000);
  return jours * 2 + (String(cle).endsWith('-pm') ? 1 : 0);
}

// Inverse de indexJour.
export function cleDeIndex(n) {
  const [a, m, d] = DATE_DEBUT.split('-').map(Number);
  const jours = Math.floor(n / 2);
  const date = new Date(Date.UTC(a, m - 1, d + jours)).toISOString().slice(0, 10);
  return `${date}-${n % 2 ? 'pm' : 'am'}`;
}

export function motDuJour(cle, mots) {
  const n = mots.length;
  return mots[((indexJour(cle) % n) + n) % n];
}
