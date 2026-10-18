const RANGEES = ['azertyuiop', 'qsdfghjklm', 'wxcvbn'];
const ORDRE = { absent: 0, present: 1, correct: 2 };

let etat = null;
let saisie = '';

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

function rendreGrille() {
  const grille = $('grille');
  grille.innerHTML = '';
  grille.style.setProperty('--colonnes', etat.longueur);
  const enCours = etat.statut === 'en_cours';

  for (let r = 0; r < etat.essaisMax; r++) {
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
      } else if (c === 0) {
        cellule.textContent = etat.premiereLettre.toUpperCase();
        cellule.classList.add('indice');
      } else if (courante) {
        cellule.textContent = (saisie[c - 1] || '').toUpperCase();
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
  $('info').textContent = `Mot du ${etat.jour} · ${etat.longueur} lettres · ${etat.essaisMax} essais · mode dur`;
  rendreGrille();
  rendreClavier();

  if (etat.statut === 'gagnee') {
    afficherMessage(`Bravo, trouvé en ${etat.essais.length} essai(s) ! Prochain mot demain à minuit.`, 'succes');
  } else if (etat.statut === 'perdue') {
    afficherMessage(`Perdu. Le mot était : ${etat.mot.toUpperCase()}. Prochain mot demain à minuit.`, 'echec');
  } else {
    afficherMessage('Mode dur : les lettres rouges et jaunes doivent être réutilisées.');
  }
}

function ajouter(lettre) {
  if (etat.statut !== 'en_cours' || saisie.length >= etat.longueur - 1) return;
  saisie += lettre;
  rendreGrille();
}

function effacer() {
  if (etat.statut !== 'en_cours') return;
  saisie = saisie.slice(0, -1);
  rendreGrille();
}

async function soumettre() {
  if (etat.statut !== 'en_cours') return;
  if (saisie.length !== etat.longueur - 1) {
    afficherMessage(`Le mot doit contenir ${etat.longueur} lettres.`, 'erreur');
    return;
  }
  try {
    etat = await appeler('/api/essai', {
      method: 'POST',
      body: JSON.stringify({ mot: etat.premiereLettre + saisie }),
    });
    saisie = '';
    rendreEtat();
    if (etat.statut !== 'en_cours') chargerClassement();
  } catch (erreur) {
    afficherMessage(erreur.message, 'erreur');
  }
}

document.addEventListener('keydown', (evenement) => {
  if (evenement.ctrlKey || evenement.metaKey || evenement.altKey || !etat) return;
  if (evenement.key === 'Enter') return soumettre();
  if (evenement.key === 'Backspace') return effacer();
  if (evenement.key.length === 1) {
    const lettre = normaliserLettre(evenement.key);
    if (lettre) ajouter(lettre);
  }
});

async function chargerClassement() {
  const { joueurs } = await appeler('/api/classement');
  const corps = $('classement-corps');
  corps.innerHTML = '';
  for (const joueur of joueurs) {
    const ligne = document.createElement('tr');
    const valeurs = [
      joueur.nom,
      joueur.joues,
      joueur.victoires,
      `${joueur.pourcentage}%`,
      joueur.serie,
      joueur.meilleureSerie,
      joueur.moyenneEssais ?? '–',
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
  etat = await appeler('/api/partie');
  $('jeu').hidden = false;
  rendreEtat();
  chargerClassement();
}

demarrer().catch((erreur) => afficherMessage(erreur.message, 'erreur'));
