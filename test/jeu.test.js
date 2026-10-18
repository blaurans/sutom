import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexJour, motDuJour, normaliser, score } from '../src/jeu.js';

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

test('indexJour est croissant par jour et motDuJour boucle sur la liste', () => {
  assert.equal(indexJour('2026-10-18'), 0);
  assert.equal(indexJour('2026-10-19'), 1);
  const mots = ['aaaaaaaa', 'bbbbbbbb'];
  assert.equal(motDuJour('2026-10-18', mots), 'aaaaaaaa');
  assert.equal(motDuJour('2026-10-19', mots), 'bbbbbbbb');
  assert.equal(motDuJour('2026-10-20', mots), 'aaaaaaaa');
});
