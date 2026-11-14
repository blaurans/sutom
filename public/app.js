const RANGEES = ['azertyuiop', 'qsdfghjklm', 'wxcvbn'];
const ORDRE = { absent: 0, present: 1, correct: 2 };
const COUT_AIDE = { exclure: 2, reveler: 5 };
const LIGNES_DEPART = 6;

let etat = null;
let saisie = [];
let jourAffiche = null;
let curseur = null;

const $ = (id) => document.getElementById(id);

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
  // Lettres déjà confirmées rouges dans un essai : reportées sur la ligne en cours.
  for (const essai of etat.essais) {
    essai.resultat.forEach((resultat, i) => {
      if (resultat === 'correct') fixes[i] = essai.mot[i];
    });
  }
  return fixes;
}

function lettreA(i, fixes) {
  return saisie[i] || fixes[i] || '';
}

function positionsLibres() {
  return Array.from({ length: etat.longueur - 1 }, (_, k) => k + 1);
}

function positionActive() {
  const libres = positionsLibres();
  if (curseur !== null && curseur > 0 && curseur < etat.longueur) return curseur;
  return libres[0] ?? null;
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
      } else if (courante) {
        if (c === 0) {
          cellule.textContent = fixes[0].toUpperCase();
          cellule.classList.add('indice');
        } else {
          cellule.textContent = lettreA(c, fixes).toUpperCase();
          cellule.classList.add(saisie[c] ? 'saisie' : fixes[c] ? 'connue' : 'saisie');
          if (positionActive() === c) cellule.classList.add('actif');
          cellule.addEventListener('click', () => {
            curseur = c;
            rendreGrille();
          });
        }
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
    afficherMessage(`Bravo, trouvé en ${etat.essais.length} essai(s) ! Prochain mot ${etat.jour.endsWith('-pm') ? 'demain à minuit' : 'à midi'}.`, 'succes');
  } else if (etat.statut === 'perdue') {
    afficherMessage(`Perdu. Le mot était : ${etat.mot.toUpperCase()}. Prochain mot ${etat.jour.endsWith('-pm') ? 'demain à minuit' : 'à midi'}.`, 'echec');
  } else {
    afficherMessage('');
  }
}

function ajouter(lettre) {
  if (etat.statut !== 'en_cours' || etat.aides.exclues.includes(lettre)) return;
  if (positionActive() === null) return;
  saisie[positionActive()] = lettre;
  avancerCurseur();
  rendreGrille();
}

function avancerCurseur() {
  const libres = positionsLibres();
  const i = libres.indexOf(positionActive());
  curseur = i === -1 || i === libres.length - 1 ? positionActive() : libres[i + 1];
}

function deplacerCurseur(delta) {
  if (etat.statut !== 'en_cours') return;
  const i = positionActive();
  if (i === null) return;
  curseur = Math.max(1, Math.min(etat.longueur - 1, i + delta));
  rendreGrille();
}

function effacer() {
  if (etat.statut !== 'en_cours') return;
  const i = positionActive();
  if (i === null) return;
  if (saisie[i]) {
    saisie[i] = '';
  } else if (i > 1) {
    curseur = i - 1;
    saisie[curseur] = '';
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
    curseur = null;
    rendreEtat();
    if (etat.statut !== 'en_cours') {
      chargerClassement();
      chargerJours().then(afficherLibelleJour);
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
  if (evenement.key === 'ArrowLeft' || evenement.key === 'ArrowRight') {
    return deplacerCurseur(evenement.key === 'ArrowRight' ? 1 : -1);
  }
  if (evenement.key.length === 1) {
    const lettre = normaliserLettre(evenement.key);
    if (lettre) ajouter(lettre);
  }
});

let joursParCle = new Map();
let cleCourante = null;
let dateSelectionnee = null;
let moisCalendrier = null;

async function chargerJours() {
  const { aujourdhui, jours } = await appeler('/api/jours');
  joursParCle = new Map(jours.map(({ cle, statut }) => [cle, statut]));
  cleCourante = aujourdhui;
  return aujourdhui;
}

function libelleCle(cle) {
  const [, mois, jour] = cle.split('-');
  return `${jour}-${mois} ${cle.endsWith('-pm') ? 'après-midi' : 'matin'}`;
}

function afficherLibelleJour() {
  $('libelle-jour').textContent = `Mot du ${libelleCle(jourAffiche || cleCourante)}`;
}

function rendreCalendrier() {
  const [annee, mois] = moisCalendrier;
  const premier = new Date(Date.UTC(annee, mois - 1, 1));
  const decalage = (premier.getUTCDay() + 6) % 7;
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  $('cal-mois').textContent = premier.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const grille = $('cal-grille');
  grille.innerHTML = '';
  for (let i = 0; i < decalage; i++) grille.appendChild(document.createElement('span'));

  for (let j = 1; j <= nbJours; j++) {
    const date = `${annee}-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
    const matin = `${date}-am`;
    const soir = `${date}-pm`;
    const futur = matin > cleCourante;
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'cal-jour';
    bouton.disabled = futur;
    if (date === dateSelectionnee) bouton.classList.add('choisi');
    if (matin === cleCourante || soir === cleCourante) bouton.classList.add('aujourdhui');

    const numero = document.createElement('span');
    numero.textContent = j;
    bouton.appendChild(numero);

    const barres = document.createElement('span');
    barres.className = 'cal-barres';
    for (const cle of [matin, soir]) {
      const barre = document.createElement('span');
      const statut = joursParCle.get(cle);
      barre.className = `barre${statut ? ` ${statut}` : ''}`;
      barres.appendChild(barre);
    }
    bouton.appendChild(barres);
    bouton.addEventListener('click', () => {
      dateSelectionnee = date;
      const matinJouable = matin <= cleCourante;
      const soirJouable = soir <= cleCourante;
      $('cal-matin').disabled = !matinJouable;
      $('cal-soir').disabled = !soirJouable;
      rendreCalendrier();
    });
    grille.appendChild(bouton);
  }

  $('cal-matin').disabled = !dateSelectionnee || `${dateSelectionnee}-am` > cleCourante;
  $('cal-soir').disabled = !dateSelectionnee || `${dateSelectionnee}-pm` > cleCourante;
}

function ouvrirCalendrier() {
  const cle = jourAffiche || cleCourante;
  const [annee, mois] = cle.slice(0, 7).split('-').map(Number);
  moisCalendrier = [annee, mois];
  dateSelectionnee = cle.slice(0, 10);
  rendreCalendrier();
  $('calendrier').showModal();
}

function decalerMois(delta) {
  const [annee, mois] = moisCalendrier;
  const suivant = new Date(Date.UTC(annee, mois - 1 + delta, 1));
  moisCalendrier = [suivant.getUTCFullYear(), suivant.getUTCMonth() + 1];
  rendreCalendrier();
}

async function choisirPeriode(demi) {
  const cle = `${dateSelectionnee}-${demi}`;
  if (cle > cleCourante) return;
  $('calendrier').close();
  await changerJour(cle);
}

async function changerJour(jour) {
  saisie = [];
  curseur = null;
  jourAffiche = jour;
  etat = await appeler(`/api/partie?jour=${encodeURIComponent(jour)}`);
  afficherLibelleJour();
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
  const aujourdhui = await chargerJours();
  await changerJour(aujourdhui);
  chargerClassement();
}

$('ouvrir-calendrier').addEventListener('click', ouvrirCalendrier);
$('cal-prec').addEventListener('click', () => decalerMois(-1));
$('cal-suiv').addEventListener('click', () => decalerMois(1));
$('cal-matin').addEventListener('click', () => choisirPeriode('am'));
$('cal-soir').addEventListener('click', () => choisirPeriode('pm'));
$('tout-effacer').addEventListener('click', toutEffacer);
$('valider').addEventListener('click', soumettre);
$('aide-exclure').addEventListener('click', () => utiliserAide('exclure'));
$('aide-reveler').addEventListener('click', () => utiliserAide('reveler'));
$('mode-emploi-ouvrir').addEventListener('click', () => {
  const modeEmploi = $('mode-emploi');
  modeEmploi.showModal();
  // Le navigateur donne le focus au bouton « Fermer » (en bas) : on revient en haut.
  modeEmploi.scrollTop = 0;
});
$('mode-emploi-fermer').addEventListener('click', () => $('mode-emploi').close());

demarrer().catch((erreur) => afficherMessage(erreur.message, 'erreur'));
