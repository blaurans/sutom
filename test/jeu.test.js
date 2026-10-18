import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexJour, motDuJour, normaliser, score, violationModeDur } from '../src/jeu.js';

test('normaliser retire accents, casse et caractères non alphabétiques', () => {
  assert.equal(normaliser('Élève'), 'eleve');
  assert.equal(normaliser('  ça-va '), 'cava');
});

test('score gère les lettres doublées', () => {
  assert.deepEqual(score('xbxbxxxx', 'bbcdefgh'), [
    'absent', 'correct', 'absent', 'present', 'absent', 'absent', 'absent', 'absent',
  ]);
  assert.deepEqual(score('plaisirs', 'plaisirs'), Array(8).fill('correct'));
});

test('mode dur impose la réutilisation des lettres rouges', () => {
  assert.match(violationModeDur(['chevaleur'], 'chaussure', 'cerisiers'), /H en position 2/);
  assert.equal(violationModeDur(['chevaleur'], 'chaussure', 'chaussure'), null);
});

test('mode dur impose la présence des lettres jaunes', () => {
  assert.match(violationModeDur(['xxxxxxxxh'], 'chaussure', 'cerisiers'), /H doit être réutilisée/);
  assert.equal(violationModeDur(['xxxxxxxxh'], 'chaussure', 'chevaleur'), null);
});

test('indexJour est croissant par jour et motDuJour boucle sur la liste', () => {
  assert.equal(indexJour('2026-10-18'), 0);
  assert.equal(indexJour('2026-10-19'), 1);
  const mots = ['aaaaaaaa', 'bbbbbbbb'];
  assert.equal(motDuJour('2026-10-18', mots), 'aaaaaaaa');
  assert.equal(motDuJour('2026-10-19', mots), 'bbbbbbbb');
  assert.equal(motDuJour('2026-10-20', mots), 'aaaaaaaa');
});
