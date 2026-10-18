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

function compterLettres(mot) {
  const comptes = {};
  for (const lettre of mot) comptes[lettre] = (comptes[lettre] || 0) + 1;
  return comptes;
}

export function violationModeDur(historique, cible, mot) {
  const requises = {};
  for (const passe of historique) {
    const resultat = score(passe, cible);
    const confirmees = {};
    for (let i = 0; i < cible.length; i++) {
      if (resultat[i] === 'correct' && mot[i] !== passe[i]) {
        return `La lettre ${passe[i].toUpperCase()} en position ${i + 1} doit être conservée (mode dur).`;
      }
      if (resultat[i] !== 'absent') {
        confirmees[passe[i]] = (confirmees[passe[i]] || 0) + 1;
      }
    }
    for (const [lettre, n] of Object.entries(confirmees)) {
      requises[lettre] = Math.max(requises[lettre] || 0, n);
    }
  }
  const comptes = compterLettres(mot);
  for (const [lettre, n] of Object.entries(requises)) {
    if ((comptes[lettre] || 0) < n) {
      return `La lettre ${lettre.toUpperCase()} doit être réutilisée (mode dur).`;
    }
  }
  return null;
}

export function jourParis(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function indexJour(jour) {
  const [annee, mois, jourDuMois] = jour.split('-').map(Number);
  const [a, m, d] = DATE_DEBUT.split('-').map(Number);
  return Math.round((Date.UTC(annee, mois - 1, jourDuMois) - Date.UTC(a, m - 1, d)) / 86400000);
}

export function motDuJour(jour, mots) {
  const n = mots.length;
  return mots[((indexJour(jour) % n) + n) % n];
}
