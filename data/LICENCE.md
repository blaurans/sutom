# Licence des données

Les fichiers de ce dossier sont dérivés de **Lexique 3** (http://www.lexique.org),
distribué sous licence **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).

- `dictionnaire.txt` : formes fléchies normalisées (minuscules, sans accents, 8 à 10 lettres, a-z uniquement), union de :
  - Lexique 3 (CC BY-SA 4.0) ;
  - le dictionnaire orthographique français Dicollecte v7.5 (MPL-2.0, Olivier R. / grammalecte.net), via le paquet npm `dictionary-fr` 3.0.0, étendu avec `unmunch`. Attention : les lignes de sortie d'`unmunch` peuvent conserver un suffixe de drapeaux Hunspell (`mot/A1B1`) qu'il faut retirer (couper au premier `/`) avant filtrage, sinon de nombreux mots sont perdus.
- `mots-du-jour.txt` : 1 311 lemmes connus mais non triviaux issus de Lexique 3 (fréquence entre 2,5 et 60 par million ; noms singuliers masculine ou feminine, verbes à l'infinitif, adjectifs singuliers masculine), filtrés, mélangés de façon déterministe.

Référence : New, B., Pallier, C., Brysbaert, M., Ferrand, L. (2004). Lexique 2 : une nouvelle base de données lexicales. Revue Mise au point / Lexique 3.
