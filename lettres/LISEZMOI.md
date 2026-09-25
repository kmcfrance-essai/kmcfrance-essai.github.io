# Lettres KBS

Page : **https://kmcfrance.github.io/lettres/?evt=<id>** (tuile « Lettres KBS » du hub).

Elle produit les lettres automatiques à charger dans KBS, au format **.docx** (KBS n'accepte que ce format). Chaque lettre existe en quatre versions : présentiel et streaming, en français et en anglais.

Lettres de CD2026 : 01 Panier, 02 Arrhes non reçues (annulation en instance), 03 Annulation, 04 Confirmation. Les conditions générales (19) viendront plus tard.

## Principe

- Les **variables KBS** (`[DearOne]`, `[ref]`, `[yourCart]`…) restent telles quelles. KBS les remplace à l'envoi.
- Les **informations de l'événement** s'écrivent `{evenement}`, `{dates}`, `{lienNavettes}`… Elles viennent de la fiche de l'événement (page Préparer). L'onglet **Valeurs** permet de les remplacer pour les lettres seulement.
- Les **textes** sont dans `evenements/<id>/lettres.json`. Le bouton **Enregistrer sur GitHub** utilise le même jeton que la page Préparer. Tant que ce n'est pas enregistré, les modifications restent gardées sur l'ordinateur.

## Nouvel événement

1. Ouvrir `/lettres/?evt=<nouvel id>`.
2. Cliquer **Reprendre ces lettres** (à partir de CD2026, par exemple). Les textes sont copiés, et les nom, dates et liens viennent de la nouvelle fiche.
   Si les deux événements ne sont pas du même type (Célébration → Festival, ou l'inverse), la page propose des **remplacements automatiques**,
   avec le nombre par lettre et un aperçu avant de confirmer : la Célébration → le Festival, de la → du, à la → au, cette → ce,
   « la {evenement} » → « le {evenement} », Celebration → Festival en anglais (et l'inverse). Le nom de l'ancien événement,
   s'il est écrit en toutes lettres, est remplacé par le nouveau. Les variables `[…]`, les valeurs `{…}`, les adresses des liens
   et les adresses e-mail ne sont jamais modifiées. On peut aussi garder les textes tels quels et utiliser « Remplacer dans toutes les lettres ».
3. Onglet **Valeurs** : remplir ce qui est en rouge (horaires des navettes, etc.).
4. Onglet **Vérifier et tout télécharger** : corriger les lettres qui ne sont pas « Prête » (en erreur ou « À relire »), puis télécharger le .zip.
5. **Enregistrer sur GitHub**.

## Balisage

Le bouton « Aide » de l'éditeur donne la liste complète. En bref :

- `@entete` : en-tête de la lettre.
- `# Titre` : titre de la lettre.
- `## Partie` : partie numérotée.
- `- puce` : ligne à puce.
- `!! alerte` : ligne mise en avant.
- `---` : trait de séparation.
- `@signature` et `@signature-kbs` : signature.
- `@pied` : bas de page.
- `**gras**`, `*italique*` : mise en forme.
- `[texte](adresse)` : lien caché derrière un texte.

## Type d'événement

Le vocabulaire vérifié dépend du **type** de l'événement, réglé dans la page Préparer (section Général, champ `typeEvenement` de la fiche ;
s'il est absent, il est déduit du nom : « Festival… » → Festival, « Célébration… » → Célébration, sinon Autre). L'en-tête de la page l'affiche.

| Type | Erreur | Point à vérifier |
|---|---|---|
| Célébration | « Festival », « festivaliers » (on écrit « Célébration » et « participants ») | |
| Festival | « Célébration » / « Celebration » (vient sans doute de la lettre copiée) | « festivaliers » (préférer « participants ») |
| Autre | | les deux termes dans la même lettre |

Le nom de l'événement lui-même, les valeurs venues de la fiche, les variables KBS, les adresses des liens et les adresses e-mail
(ex. inscriptions-festival@kadampafrance.org) ne sont jamais signalés.

## Vérifications automatiques

Une lettre avec une **erreur** n'est pas « Prête » : le bouton « Télécharger le .docx » l'explique et ne propose
« Télécharger quand même » qu'en second choix ; le .zip laisse ces lettres de côté, sauf si on choisit de les inclure.
Une lettre « À relire » (version streaming rédigée à partir du présentiel) n'est pas comptée comme prête non plus.

Erreurs :

- variable KBS inconnue ou mal écrite (`[ ref ]`) ;
- valeur `{…}` vide ;
- lien `/edit` ;
- adresse de lien invalide ;
- terme qui ne correspond pas au type d'événement (voir plus haut) ;
- accord : « la Festival », « à la Festival », « au Célébration »… (souvent après un remplacement) ;
- texte à compléter (`>>> … <<<`, `TODO`).

Les **points à vérifier** ne bloquent pas l'envoi :

- adresse affichée en clair ;
- variable-lien KBS affichée dans le texte (`[yourCart]` hors d'un lien) : vérifier le rendu dans un envoi test ;
- « transmission de pouvoir » ou « empowerment » (on écrit « transmission des bénédictions », « blessing ») ;
- année différente de celle de l'événement ;
- gras ou italique mal fermé ;
- formulaire encore en test.
