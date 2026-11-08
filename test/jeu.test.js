import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleDeIndex, clePeriode, indexJour, motDuJour, normaliser, score } from '../src/jeu.js';

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

test('indexJour compte deux périodes par jour et cleDeIndex fait le retour', () => {
  assert.equal(indexJour('2026-10-18-am'), 0);
  assert.equal(indexJour('2026-10-18-pm'), 1);
  assert.equal(indexJour('2026-10-18'), 0);
  assert.equal(indexJour('2026-10-19-am'), 2);
  for (const n of [0, 1, 2, 5, 40]) {
    assert.equal(indexJour(cleDeIndex(n)), n);
  }
  assert.equal(cleDeIndex(0), '2026-10-18-am');
  assert.equal(cleDeIndex(1), '2026-10-18-pm');
  assert.equal(cleDeIndex(3), '2026-10-19-pm');
});

test('motDuJour change à chaque période et boucle sur la liste', () => {
  const mots = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'];
  assert.equal(motDuJour('2026-10-18-am', mots), 'aaaaaaaa');
  assert.equal(motDuJour('2026-10-18-pm', mots), 'bbbbbbbb');
  assert.equal(motDuJour('2026-10-19-am', mots), 'cccccccc');
  assert.equal(motDuJour('2026-10-19-pm', mots), 'aaaaaaaa');
});
