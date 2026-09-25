# Fiches événement

Chaque événement a **une fiche** : `/evenements/<id>/fiche.json`, avec ses images dans le même dossier.
Tous les outils la lisent : le hub, l'app mobile (`/app/`), l'outil liens (`/liens/`), les badges (`/badges/`)
et les formulaires navettes et bénévolat (`/navettes/`, `/benevolat/`).

- `index.json` contient la liste des événements et l'événement **courant**, celui qui s'ouvre sans `?evt=` dans l'adresse.
- `_modele/` est une fiche vierge de référence. Les dossiers qui commencent par `_` ne sont jamais publiés ni utilisés.
- `cd2026/` est la fiche de la Célébration du Dharma 2026. Elle sert de référence et d'archive.

## Préparer ou modifier un événement : la page « Préparer »

**https://kmcfrance.github.io/preparer/** (bouton « Préparer / modifier un événement » en haut du hub).
Plus besoin d'ouvrir GitHub : la page remplit la fiche, réduit les images et enregistre tout sur GitHub en une seule fois.

1. **Une seule fois : le jeton GitHub.** Bouton « Connexion GitHub » → suivre « Comment créer un jeton ? »
   (jeton *fine-grained*, propriétaire `kmcfrance`, dépôt `kmcfrance.github.io` seulement, permission
   **Contents : Read and write**, 1 an). Le jeton reste dans le navigateur ; ne jamais le partager.
   Sans jeton, la page propose de **télécharger les fichiers** à déposer à la main sur GitHub.
2. **Nouvel événement** : « Partir d'un modèle vierge », ou mieux « Dupliquer un événement existant ».
   En duplication, changer le nom puis le premier jour : la page propose de **décaler** programme, dates clés,
   horaires du café et fin du différé du même nombre de jours. Les adresses des anciens outils et les bases
   Firebase de l'événement copié sont retirées exprès (chaque événement a les siennes).
3. **Remplir** section par section. La colonne « Vérification » bloque l'enregistrement en cas d'erreur
   (dates, heures, adresses…) et signale le reste (Firebase pas encore créé, images manquantes…).
   Le travail est gardé automatiquement sur l'ordinateur (brouillon) jusqu'à l'enregistrement.
4. **Enregistrer sur GitHub** : fiche, nouvelles images et `index.json` en un seul enregistrement.
   Cocher « En faire l'événement courant » le jour venu. Le site suit en 1 à 2 minutes.
5. **Firebase** : créer une base Realtime Database pour l'app et un projet Firestore pour les liens
   (voir `/app/LISEZMOI.md` et `/liens/LISEZMOI.md`), puis coller leurs adresses dans la section
   « App & streaming » (la configuration Firebase se colle telle quelle, elle est découpée automatiquement).
6. **Vérification.** Ouvrir les liens proposés après l'enregistrement : hub (`?evt=<id>`), app, admins.
7. **App.** Dans l'admin de l'app, « Initialiser depuis la fiche » reprend le programme, les infos et le café.
   Ensuite, tout se modifie dans l'admin, comme d'habitude.
8. **Liens.** Dans l'admin des liens, créer le mot de passe à la première connexion, puis « Pré-remplir les séances ».
8 bis. **Formulaires.** Dans les admins Navettes et Bénévolat : « Partir du modèle » (ou reprendre les questions d'un autre
   événement), relire, « Publier », puis ouvrir le formulaire (onglet « Ouverture & lien »). Le projet Firebase des formulaires
   est commun à tous les événements : il se crée une seule fois (voir `/commun/FORMULAIRES.md`) et il est gardé en duplication.
9. **Après l'événement (RGPD).** Supprimer les participants du streaming, ou le projet Firebase, après la date
   `streaming.finDiffere` plus un délai raisonnable. Supprimer aussi les réponses des formulaires navettes et bénévolat
   (admin → Réglages → « Supprimer toutes les réponses »).

**CD2026** : ses outils sont figés (`cd2026-*`). La page peut modifier sa fiche, mais cela ne change que
ce qu'affiche le hub (dates clés, liens, contacts). Ses adresses `app.url`, `streaming.url`… sont conservées.

À la main (secours) : copier `_modele/` en `<id>/`, remplir `fiche.json` (le champ `id` = nom du dossier),
déposer les images et ajouter l'événement dans `index.json`. Le modèle vierge de la page « Préparer » est
intégré à la page elle-même (`/preparer/index.html`, constante `MODELE`) : le garder en phase avec `_modele/`.

## Les champs de la fiche

Les textes bilingues s'écrivent `{ "fr": "…", "en": "…" }`.

Les dates s'écrivent `AAAA-MM-JJ` et les heures `HH:MM`, en heure de Paris.

| Champ | Rôle |
|---|---|
| `id`, `code` | Identifiant (nom du dossier) et code court (ex. `CD2026`) |
| `typeEvenement` | `celebration` (Célébration du Dharma), `festival` (ex. Festival français 2027) ou `autre`. Règle le vocabulaire vérifié dans les lettres KBS (voir `/lettres/LISEZMOI.md`). Absent = déduit du nom (« Festival… », « Célébration… », sinon autre) ; c'est le cas du modèle `_modele/`, pour qu'une fiche copiée à la main suive son nom. La page Préparer (liste « Type d'événement », section Général) l'écrit pour tout nouvel événement ; sur une fiche existante qui ne l'a pas, seulement si on choisit un type. |
| `nom`, `nomAffiche`, `sousTitre` | Nom, nom sur l'écran d'accueil de l'app (`<br>` autorisé), thème |
| `debut`, `fin` | Premier et dernier jour. Les onglets de jours de l'app en découlent. |
| `lieu`, `enseignant`, `pageWeb`, `presentation` | Informations générales |
| `charte` | Couleurs : `principale`, `principaleFoncee`, `principaleClaire`, `secondaire`, `secondaireClaire`, `accent` |
| `images` | `visuel` (bandeau de l'app, page streaming), `visuelHD`, `fond`. La page « Préparer » les nomme `visuel.jpg`, `visuel-hd.jpg`, `fond.jpg`. |
| `app.firebaseUrl` | Base Realtime Database de l'app |
| `app.url` / `app.admin` | **À laisser vide pour un nouvel événement** : les outils génériques `/app/?evt=…` sont alors utilisés. Seule la fiche CD2026 les remplit, pour pointer vers ses anciens outils. |
| `streaming.firebase`, `streaming.emailjs` | Configuration Firebase (web) et EmailJS de l'outil liens |
| `streaming.finDiffere`, `expediteur`, `contact` | Fin du différé, nom de l'expéditeur, adresse de contact |
| `formulaires.test` | `true` = formulaires **en test** pour cet événement : liens non affichés sur le hub, bandeau « version de test » sur les formulaires, pastille « En test » dans les admins (case dans Préparer → App & streaming). |
| `formulaires.firebase` | Configuration Firebase (web) du projet des **formulaires** navettes et bénévolat. Le même pour tous les événements, et différent de celui des liens. Vide = formulaires pas encore disponibles pour l'événement. Les questions ne sont **pas** dans la fiche : elles se gèrent dans les admins. |
| `programme[]` | `jour`, `debut`, `fin`, `titre`, `type` (`teaching`, `meditation`, `ceremony`, `meal`, `practical`), `desc`, `badge`. Ajouter `seance` (nom) pour que l'élément devienne une séance de streaming. |
| `infos[]` | Rubriques « Infos pratiques » de l'app (`contenu` en HTML simple) |
| `cafe.carte[]`, `cafe.horaires[]`, `cafe.note` | Carte et horaires du café. Si le bloc est absent, l'onglet est masqué. |
| `boutique[]` | Articles de la boutique |
| `datesCles[]` | Frise et compte à rebours du hub |
| `liens[]`, `contacts[]` | Liens utiles et contacts du hub (adresses de service seulement : la page est publique) |

**Ne jamais mettre de mot de passe ni de donnée personnelle dans une fiche** : elle est publique.
