const RANGEES = ['azertyuiop', 'qsdfghjklm', 'wxcvbn'];
const ORDRE = { absent: 0, present: 1, correct: 2 };
const COUT_AIDE = { exclure: 2, reveler: 5 };
const LIGNES_DEPART = 6;

let etat = null;
let saisie = [];
let jourAffiche = null;

const $ = (id) => document.getElementById(id);

const LIBELLES_STATUT = { en_cours: 'en cours', gagnee: 'gagné', perdue: 'perdu' };

function normaliserLettre(touche) {
  return touche.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
}

async function appeler(url, options = {}) {
  const reponse = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(donnees.erreur || 'Erreur');
    erreur.statut = reponse.status;
    throw erreur;
  }
  return donnees;
}

function afficherMessage(texte, classe = '') {
  const message = $('message');
  message.textContent = texte;
  message.className = classe;
}

function lettresFixes() {
  const fixes = Array(etat.longueur).fill(null);
  fixes[0] = etat.premiereLettre;
  for (const { position, lettre } of etat.aides.revelees) fixes[position] = lettre;
  return fixes;
}

function lettreA(i, fixes) {
  return fixes[i] ?? saisie[i] ?? '';
}

function rendreGrille() {
  const grille = $('grille');
  grille.innerHTML = '';
  grille.style.setProperty('--colonnes', etat.longueur);
  const enCours = etat.statut === 'en_cours';
  const fixes = lettresFixes();
  const lignes = Math.min(etat.essaisMax, Math.max(LIGNES_DEPART, etat.essais.length + (enCours ? 1 : 0)));

  for (let r = 0; r < lignes; r++) {
    const ligne = document.createElement('div');
    ligne.className = 'ligne';
    const essai = etat.essais[r];
    const courante = enCours && r === etat.essais.length;

    for (let c = 0; c < etat.longueur; c++) {
      const cellule = document.createElement('div');
      cellule.className = 'case';
      if (essai) {
        cellule.textContent = essai.mot[c].toUpperCase();
        cellule.classList.add(essai.resultat[c]);
      } else if (fixes[c]) {
        cellule.textContent = fixes[c].toUpperCase();
        cellule.classList.add('indice');
      } else if (courante) {
        cellule.textContent = (saisie[c] || '').toUpperCase();
        cellule.classList.add('saisie');
      }
      ligne.appendChild(cellule);
    }
    grille.appendChild(ligne);
  }
}

function rendreClavier() {
  const etatLettres = {};
  for (const essai of etat.essais) {
    essai.mot.split('').forEach((lettre, i) => {
      const niveau = essai.resultat[i];
      if (!etatLettres[lettre] || ORDRE[niveau] > ORDRE[etatLettres[lettre]]) {
        etatLettres[lettre] = niveau;
      }
    });
  }
  for (const lettre of etat.aides.exclues) etatLettres[lettre] = 'absent';

  const clavier = $('clavier');
  clavier.innerHTML = '';
  const ajouterTouche = (libelle, action, rangee, classe = '') => {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.textContent = libelle;
    bouton.className = `touche ${classe}`;
    if (etatLettres[action]) bouton.classList.add(etatLettres[action]);
    bouton.addEventListener('click', () => {
      if (libelle === 'ENTRÉE') soumettre();
      else if (libelle === '⌫') effacer();
      else ajouter(action);
    });
    rangee.appendChild(bouton);
  };

  RANGEES.forEach((lettres, index) => {
    const rangee = document.createElement('div');
    rangee.className = 'rangee';
    if (index === 2) ajouterTouche('ENTRÉE', null, rangee, 'large');
    for (const lettre of lettres) ajouterTouche(lettre.toUpperCase(), lettre, rangee);
    if (index === 2) ajouterTouche('⌫', null, rangee, 'large');
    clavier.appendChild(rangee);
  });
}

function rendreEtat() {
  rendreGrille();
  rendreClavier();

  if (etat.statut === 'gagnee') {
    afficherMessage(`Bravo, trouvé en ${etat.essais.length} essai(s) ! Prochain mot demain à minuit.`, 'succes');
  } else if (etat.statut === 'perdue') {
    afficherMessage(`Perdu. Le mot était : ${etat.mot.toUpperCase()}. Prochain mot demain à minuit.`, 'echec');
  } else {
    afficherMessage('');
  }
}

function ajouter(lettre) {
  if (etat.statut !== 'en_cours' || etat.aides.exclues.includes(lettre)) return;
  const fixes = lettresFixes();
  const i = fixes.findIndex((l, idx) => l === null && !saisie[idx]);
  if (i === -1) return;
  saisie[i] = lettre;
  rendreGrille();
}

function effacer() {
  if (etat.statut !== 'en_cours') return;
  const fixes = lettresFixes();
  for (let i = fixes.length - 1; i >= 0; i--) {
    if (fixes[i] === null && saisie[i]) {
      saisie[i] = '';
      break;
    }
  }
  rendreGrille();
}

function toutEffacer() {
  if (etat.statut !== 'en_cours') return;
  saisie = [];
  rendreGrille();
}

async function soumettre() {
  if (etat.statut !== 'en_cours') return;
  const fixes = lettresFixes();
  const lettres = fixes.map((_, i) => lettreA(i, fixes));
  if (lettres.some((l) => !l)) {
    afficherMessage(`Le mot doit contenir ${etat.longueur} lettres.`, 'erreur');
    return;
  }
  try {
    etat = await appeler('/api/essai', {
      method: 'POST',
      body: JSON.stringify({ jour: etat.jour, mot: lettres.join('') }),
    });
    saisie = [];
    rendreEtat();
    if (etat.statut !== 'en_cours') {
      chargerClassement();
      chargerChoixJour();
    }
  } catch (erreur) {
    afficherMessage(erreur.message, 'erreur');
  }
}

async function utiliserAide(type) {
  if (etat.statut !== 'en_cours') return;
  const libelle = type === 'exclure' ? 'enlever une lettre' : 'donner une lettre';
  if (!confirm(`Utiliser l'aide « ${libelle} » pour ${COUT_AIDE[type]} points ?`)) return;
  const avant = etat.aides;
  try {
    etat = await appeler('/api/aide', {
      method: 'POST',
      body: JSON.stringify({ jour: etat.jour, type }),
    });
    rendreEtat();
    if (type === 'exclure') {
      const nouvelle = etat.aides.exclues.find((l) => !avant.exclues.includes(l));
      afficherMessage(`La lettre ${nouvelle.toUpperCase()} n'est pas dans le mot (−${COUT_AIDE[type]} pts).`, 'indice-texte');
    } else {
      const nouvelle = etat.aides.revelees.find((r) => !avant.revelees.some((a) => a.position === r.position));
      afficherMessage(`La lettre ${nouvelle.lettre.toUpperCase()} est en position ${nouvelle.position + 1} (−${COUT_AIDE[type]} pts).`, 'indice-texte');
    }
  } catch (erreur) {
    afficherMessage(erreur.message, 'erreur');
  }
}

document.addEventListener('keydown', (evenement) => {
  if (evenement.ctrlKey || evenement.metaKey || evenement.altKey || !etat) return;
  if (evenement.key === 'Enter') return soumettre();
  if (evenement.key === 'Backspace') return effacer();
  if (evenement.key === 'Escape') return toutEffacer();
  if (evenement.key.length === 1) {
    const lettre = normaliserLettre(evenement.key);
    if (lettre) ajouter(lettre);
  }
});

async function chargerChoixJour() {
  const { aujourdhui, jours } = await appeler('/api/jours');
  const choix = $('choix-jour');
  choix.innerHTML = '';
  for (const { jour } of jours) {
    const option = document.createElement('option');
    option.value = jour;
    option.textContent = `${jour.slice(8, 10)}-${jour.slice(5, 7)}`;
    choix.appendChild(option);
  }
  choix.value = jourAffiche || aujourdhui;
  return aujourdhui;
}

async function changerJour(jour) {
  saisie = [];
  jourAffiche = jour;
  etat = await appeler(`/api/partie?jour=${encodeURIComponent(jour)}`);
  rendreEtat();
}

async function chargerClassement() {
  const { joueurs } = await appeler('/api/classement');
  const corps = $('classement-corps');
  corps.innerHTML = '';
  for (const joueur of joueurs) {
    const ligne = document.createElement('tr');
    const valeurs = [
      joueur.nom,
      joueur.score,
      joueur.joues,
      joueur.victoires,
      `${joueur.pourcentage}%`,
      joueur.serie,
      joueur.meilleureSerie,
    ];
    for (const valeur of valeurs) {
      const cellule = document.createElement('td');
      cellule.textContent = valeur;
      ligne.appendChild(cellule);
    }
    corps.appendChild(ligne);
  }
  $('classement').hidden = false;
}

async function demarrer() {
  let session;
  try {
    session = await appeler('/api/me');
  } catch {
    $('connexion').hidden = false;
    return;
  }

  $('nom').textContent = session.nom;
  $('compte').hidden = false;
  $('zone-jour').hidden = false;
  $('jeu').hidden = false;
  const aujourdhui = await chargerChoixJour();
  await changerJour(aujourdhui);
  chargerClassement();
}

$('choix-jour').addEventListener('change', (evenement) => changerJour(evenement.target.value));
$('tout-effacer').addEventListener('click', toutEffacer);
$('valider').addEventListener('click', soumettre);
$('aide-exclure').addEventListener('click', () => utiliserAide('exclure'));
$('aide-reveler').addEventListener('click', () => utiliserAide('reveler'));
$('mode-emploi-ouvrir').addEventListener('click', () => $('mode-emploi').showModal());
$('mode-emploi-fermer').addEventListener('click', () => $('mode-emploi').close());

demarrer().catch((erreur) => afficherMessage(erreur.message, 'erreur'));
