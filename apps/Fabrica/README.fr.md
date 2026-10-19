# Fabrica

[English](README.md) · [Română](README.ro.md) · **Français** · [Italiano](README.it.md) · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Version :** 1.1.0 · **Dernière mise à jour :** 2026-10-19

Langues de l'interface : **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

Fabrica est une fabrique de cours et de quiz : vous rédigez un cours (données, avertissements, niveaux et leçons en Markdown simple, questions de sept types, glossaire, tableau de preuves, test final avec banque de questions et tirage déterminé par une graine), vous le validez et vous l'exportez sous la forme d'**un seul fichier HTML autonome** (en option un ZIP avec un README). Le fichier généré fonctionne hors ligne et offre navigation, progression enregistrée localement, répétition espacée pour les questions ratées, test final, certificat de parcours imprimable (sans valeur d'accréditation), mode clair/sombre et interface en 8 langues. Il comprend un exemple complet (« Comment lire une étiquette nutritionnelle ») et trois modèles de départ.

![capture d'écran](screenshot.png)

**Application en ligne :** https://chiuta.github.io/apps/Fabrica/

## Mode d'emploi

1. **Modèles** (en haut) → choisissez « Cours court avec test », « Guide avec tableau de preuves », « Quiz simple » ou l'exemple complet ; ou remplissez directement le panneau **Cours**.
2. **Cours** : titre, description, auteur, licence du contenu, langue du contenu, version, avertissements (modèles : informatif, pas un conseil médical / juridique / financier), domaines sensibles, couleur d'accent, certificat, répétition espacée.
3. **Contenu** : niveaux et leçons (monter/descendre, dupliquer, supprimer) ; texte de la leçon avec barre Markdown (titres, listes, gras/italique, liens externes et internes `[texte](lesson:id)`, tableaux, citations, images) ; questions d'entraînement par leçon.
4. **Types de questions** : choix unique, choix multiple, vrai/faux, texte à trous (`[[réponse|variante]]`), ordonnancement (avec boutons haut/bas, accessible au clavier), appariement, réponse courte (variantes acceptées ; la comparaison ignore la casse, les diacritiques et la ponctuation). Chacune a une explication et un retour pour les réponses correctes/erronées.
5. **Glossaire** (`{gl:Terme}` dans les leçons) et **Tableau de preuves** : affirmations avec un niveau (études contrôlées / observationnel / traditionnel / sans preuves), sources textuelles, repérées dans les leçons par `{ev:ID}`.
6. **Test final** : seuil, nombre de questions tirées de la banque, graine (même valeur → même tirage et même ordre), tirage différent à chaque tentative (graine + numéro de tentative), éventuellement aussi les questions des leçons. « Simuler le tirage » montre le résultat.
7. **Validation** : leçons vides, questions sans réponse correcte, liens internes cassés, images trop grandes/externes/sans texte alternatif, avertissements manquants pour les domaines sensibles (explicites ou heuristiques), sources manquantes pour les affirmations, doublons, etc. « Aller à » mène à l'endroit du problème.
8. **Aperçu** : le fichier exact tel qu'exporté, dans un cadre isolé (sandbox), en pleine largeur ou en largeur de téléphone (360 px).
9. **Export** : HTML, ZIP (index.html + README.md + source `.course.json`), source `.course.json`, sauvegarde `.fff.json`. **Import** : `.course.json`, le HTML ou le ZIP exporté (le cours en est récupéré), `.fff.json` ; questions depuis un **CSV** (colonnes : `tip;întrebare;corect;greșit1;greșit2;greșit3;explicație` ; types `unic, multi, adevarat-fals, completare, scurt, ordonare, potrivire` ; les variantes multiples sont séparées par `|`, les paires par `gauche=droite` ; délimiteur `,` `;` ou tabulation, guillemets RFC 4180).

Annuler/rétablir : les boutons de l'en-tête, `Ctrl+Z` / `Ctrl+Y` (hors des champs de texte) et le bouton « Annuler » de la notification qui suit une suppression.

## Ce qu'il ne fait PAS et ses limites

- **Il n'accrédite rien.** Le certificat est un document informatif local, sans valeur d'accréditation ni de reconnaissance ; son texte le dit.
- Il ne vérifie pas l'exactitude scientifique, juridique ou médicale du contenu : le validateur détecte les problèmes formels et (de façon heuristique, d'après des mots-clés) l'absence d'avertissement ; la responsabilité du contenu reste à l'auteur. Le niveau de preuve est choisi par l'auteur ; Fabrica ne vérifie pas les sources.
- Pas de comptes, pas de synchronisation, pas de collaboration en temps réel, pas de serveurs. La progression de l'apprenant est locale (dans son navigateur) et ne peut être vérifiée par personne ; le test n'est pas surveillé (les bonnes réponses sont dans le fichier).
- Markdown est un sous-ensemble (titres, listes imbriquées, gras/italique, code, liens, images, tableaux, citations, ligne) ; pas de HTML brut, pas de formules mathématiques, pas d'audio/vidéo intégré. Les images sont uniquement `data:` (png/jpeg/gif/webp), redimensionnées à 1000 px maximum à l'insertion ; les liens externes ne sont pas vérifiés hors ligne.
- L'ordonnancement se fait avec des boutons (pas par glisser-déposer). L'ordre aléatoire repose sur un générateur à graine, pas sur un générateur cryptographique.
- L'interface générée existe en 8 langues, mais le **contenu** du cours n'est que dans la langue écrite par l'auteur. Les modèles de départ sont en roumain et en anglais (les autres langues reçoivent la version anglaise) ; l'exemple complet est en roumain.
- Compression ZIP : l'écrivain intégré utilise « stored » (sans compression) ; le lecteur accepte aussi les ZIP compressés (deflate) lorsque le navigateur fournit `DecompressionStream`.
- Le brouillon est enregistré dans `localStorage` ; si les images dépassent le quota, un avertissement apparaît et il faut exporter le cours.

## Confidentialité

Il fonctionne en local et **n'envoie rien** (`connect-src 'none'`). Le brouillon du cours n'est conservé que dans ce navigateur (`fff.fabrica.draft`, plus la langue et le thème) ; « Tout supprimer » les efface. Le fichier généré ne contient aucune télémétrie ; la progression de l'apprenant se trouve dans `fff.course.<id>.*` et peut être exportée/importée/supprimée depuis la page « Réglages et données » du cours.

## Sécurité et CSP

L'éditeur : `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src about:; object-src 'none'; worker-src blob:; manifest-src 'none'`. Écarts justifiés : `frame-src about:` pour l'aperçu dans un cadre isolé (`srcdoc`, `sandbox="allow-scripts allow-modals"`).

Le fichier généré : `default-src 'none'; script-src 'sha256-<hash>'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; worker-src 'none'; manifest-src 'none'`. **Le hachage SHA-256 est calculé dans le navigateur** (Web Crypto, avec repli en JavaScript) au moment de l'export, à partir du texte exact du script inséré, et écrit dans `<meta http-equiv="Content-Security-Policy">` ; après l'export, Fabrica ré-analyse le fichier et vérifie le hachage, l'absence de gestionnaires en ligne et de ressources externes. Les données du cours se trouvent dans un bloc `application/json` non exécutable (avec `<`, `>`, `&` échappés) ; tous les textes sont échappés à l'affichage, les liens sont limités à `https:`, `mailto:` et aux routes internes.

## Formats

- `.course.json` : `{"format":"fabrica-course","schema":1,"app":"Fabrica","version":"1.0.0","saved":"…","course":{…}}` — le schéma est versionné ; l'import normalise et valide (types, identifiants uniques, une seule option correcte pour le choix unique, images `data:` autorisées uniquement de type image) et refuse les fichiers dont le schéma est plus récent.
- `.fff.json` (sauvegarde) : `{"format":"fff-bundle","schema":1,"app":"fabrica","version":"1.0.0","updated":"2026-10-14","data":{"draft":{…}}}`.
- Progression de l'apprenant (depuis le fichier généré) : `{"format":"fff-bundle","app":"course:<id>",…,"data":{"progress":{…}}}`.
- Import : `.course.json`, `.html`/`.zip` exportés, `.fff.json`, `.csv` (questions). Export : `.html`, `.zip`, `.course.json`, `.fff.json`.

## Technique

Un seul `index.html` (HTML + CSS + JS en ligne, sans bibliothèques externes). Le moteur de cours (player) est un script distinct dans la page ; **le même texte** est inséré dans le fichier exporté et s'exécute dans l'aperçu, de sorte que l'aperçu est identique au résultat. La répétition espacée utilise un SM-2 simplifié (EF minimal 1,3 ; intervalles de 1 jour, 6 jours, puis multiplication par EF ; en cas d'échec, l'intervalle revient à 1 jour). Sélection du test : mélange de Fisher–Yates avec un générateur mulberry32 initialisé à partir de hash(graine + tentative). Écriture/lecture ZIP et CRC-32 maison. Accessibilité : vraies légendes et étiquettes, messages `aria-live`, focus géré lors du changement de page, contraste AA dans les deux thèmes (les accents peuvent être choisis parmi cinq palettes vérifiées), `prefers-reduced-motion`, tableaux défilants avec focus. Raccourcis dans le cours généré : `Alt+Shift+→` / `Alt+Shift+←` (leçon suivante/précédente).

Les tests (`tests/test.mjs`, Playwright, réseau bloqué) couvrent l'éditeur (structure avec annulation, questions, validateur, import/export, CSV, ZIP, images, aperçu, axe) et le **fichier généré chargé sans réseau** (0 pageerror/CSP, hachage CSP recalculé dans Node, parcours des leçons, notation de chaque type, progression persistante, répétition, test avec tirage, certificat, 8 langues, axe dans les deux thèmes, 360 px).

## Tiers

Aucun code tiers. (Les tests utilisent Playwright et axe-core, uniquement en développement.)

## Traductions

L'interface de l'éditeur et des cours générés : roumain et anglais rédigés par l'auteur ; **fr, it, es, pt, hu, de sont des traductions automatiques, non vérifiées par des locuteurs natifs**. Les avertissements des modèles (informatif/médical/juridique/financier) sont aussi des traductions automatiques : ils devraient être vérifiés par un juriste/locuteur natif avant tout usage public.

## Licence

Licence : MIT — voir le fichier `LICENSE` à la racine du dépôt.

## Historique

- 1.0.0 — 2026-10-14 : première version.
- 1.1.0 — 2026-10-19 : export « Quiz pour Undava (.json) » et import depuis des fichiers Undava (.json) via le bouton d'import CSV ; seules les questions ayant un équivalent sont transférées (choix unique, vrai/faux, réponse courte, texte à trous avec un seul blanc).
