# Formulaires Navettes et Bénévolat

Deux outils distincts, chacun avec son admin, son mot de passe et ses réponses :

| Outil | Formulaire public (à diffuser) | Admin (équipe seulement) |
|---|---|---|
| Navettes | `https://kmcfrance.github.io/navettes/?evt=<id>` | `https://kmcfrance.github.io/navettes/admin.html?evt=<id>` |
| Bénévolat | `https://kmcfrance.github.io/benevolat/?evt=<id>` | `https://kmcfrance.github.io/benevolat/admin.html?evt=<id>` |

Sans `?evt=`, c'est l'événement « courant » qui s'ouvre. Le hub affiche une tuile par outil.

Les réponses servent à **mettre à jour KBS à la main**. Le paiement des navettes reste dans KBS.

- L'équipe navettes ne voit pas les réponses bénévolat, et inversement : ce sont deux comptes séparés.
- Les questions se modifient dans l'admin, sans GitHub. Rien ne change pour les participants avant « Publier ».
- Les formulaires sont en français et en anglais : bouton FR/EN, ou `&lang=en` dans le lien.

---

## 1. Mise en place (une seule fois, environ 20 minutes)

Un **seul projet Firebase** sert à tous les événements : les réponses y sont rangées par événement.
Il doit être **différent** de celui de l'outil des liens, car chaque projet a ses propres règles de sécurité.

### 1.1 Créer le projet et la base

1. Ouvrir https://console.firebase.google.com avec le compte Google du centre.
2. Cliquer sur **Ajouter un projet**. Nom : `kmcfrance-formulaires`. Google Analytics n'est pas utile : le désactiver.
3. Dans **Build → Firestore Database**, cliquer sur **Créer une base de données** :
   - emplacement : **eur3 (Europe)** ou `europe-west1`. Il ne pourra plus être changé : les données restent en Europe (RGPD) ;
   - mode : **production**.
4. Dans l'onglet **Règles**, remplacer tout le texte par le contenu du fichier
   [`/commun/firestore-formulaires.rules`](firestore-formulaires.rules), puis cliquer sur **Publier**.

### 1.2 Activer la connexion par mot de passe

5. Dans **Build → Authentication**, cliquer sur **Commencer**, puis ouvrir l'onglet **Méthode de connexion**.
6. Choisir **Adresse e-mail/Mot de passe**, cocher la première case **Activer** (pas « Lien envoyé par e-mail »), puis **Enregistrer**.

### 1.3 Déclarer l'application web et relier le projet à l'événement

7. Cliquer sur la roue dentée, puis **Paramètres du projet**, onglet **Général**, rubrique « Vos applications ».
8. Cliquer sur l'icône **`</>`** (Web). Nom : `Formulaires`. Ne pas cocher l'hébergement.
9. Copier tout le bloc `const firebaseConfig = { … }`.
10. Sur le hub, ouvrir **Préparer / modifier un événement**, puis la fiche de l'événement, puis la section **App & streaming**, rubrique **Formulaires navettes et bénévolat**.
11. Coller le bloc (les 6 valeurs se remplissent seules), puis **Enregistrer sur GitHub**.

Ce projet est ensuite gardé automatiquement quand on duplique un événement.

### 1.4 Créer les deux mots de passe, tout de suite

12. Ouvrir `/navettes/admin.html` et cliquer sur **Première utilisation : créer le mot de passe de l'outil**.
13. Cliquer sur **Générer un mot de passe**, le noter en lieu sûr, cocher la case, puis **Créer**.
14. Faire de même sur `/benevolat/admin.html`, avec un autre mot de passe.

### 1.5 Fermer la porte (important)

15. Dans **Authentication → Paramètres → Actions des utilisateurs**, **décocher « Activer la création (inscription) »**, puis **Enregistrer**.

Sans cette étape, quelqu'un qui connaîtrait la procédure pourrait créer lui-même un compte d'admin avant vous.
Une fois la création désactivée, personne ne peut plus créer de compte depuis une page web.
Les mots de passe se changent toujours depuis l'admin (onglet **Réglages**).

### 1.6 Facultatif, recommandé

- **Google Cloud Console** (https://console.cloud.google.com), projet `kmcfrance-formulaires`, **API et services → Identifiants** : ouvrir la clé API et limiter les **référents HTTP** à `https://kmcfrance.github.io/*`. Ajouter plus tard l'adresse maison si elle change.
- **App Check (reCAPTCHA)** : protection supplémentaire contre les envois automatiques en masse. Ce n'est utile qu'en cas d'abus constaté.

---

## 2. Préparer le formulaire d'un événement

**Mode test** : dans Préparer, la case **« Formulaires en test »** (App & streaming → Formulaires) permet de tout essayer sans rien diffuser. Les liens ne sont pas affichés sur le hub, les formulaires portent un bandeau « Version de test » et les admins affichent « En test ». Décocher la case pour les utiliser pour de vrai.
C'est le cas de la **Célébration du Dharma 2026**, dont les formulaires officiels restent les Google Forms. Pour elle, « Partir du modèle » donne directement la version CD2026 : horaires 12h30–19h15 et 13h–18h30, 5 €, date limite du 24 novembre, arrivée des bénévoles au plus tard le mercredi 25 à 9h.

1. Ouvrir l'admin (depuis la tuile du hub) et se connecter.
2. La première fois pour cet événement :
   - soit **Partir du modèle** : les questions habituelles, avec les dates reprises de la fiche ;
   - soit **Reprendre les questions d'un autre événement** : les jours autorisés et les dates limites peuvent être décalés automatiquement de l'écart entre les deux événements. Relire quand même les textes qui citent des dates.

   Le formulaire est créé **fermé**.
3. Dans l'onglet **Questions** :
   - cliquer sur une question pour la modifier : type, intitulé FR/EN, aide, réponse obligatoire, réponses possibles, limites, condition d'affichage ;
   - ajouter une question avec **+ Ajouter une question**. Types disponibles : texte court, paragraphe, e-mail, téléphone, choix unique, liste déroulante, cases à cocher, case seule, date, heure, **jour et heure (plages)**, nombre, titre de partie ;
   - **Aperçu** montre exactement ce que verront les participants (FR et EN). On peut y tester les erreurs et les conditions ;
   - **Publier** met la nouvelle version en ligne. La publication est bloquée tant qu'une erreur reste (réponse vide, condition cassée…). Les remarques, comme une traduction manquante, n'empêchent pas de publier.
4. Dans l'onglet **Ouverture & lien** :
   - cocher **Formulaire ouvert** ;
   - si besoin, fixer une ouverture et une **fermeture automatiques** (par exemple la date limite des navettes), en heure de Paris ;
   - copier le **lien**. Il ne change jamais et peut aller dans les lettres KBS, derrière un texte (« Réserver ma navette »), jamais l'adresse brute ;
   - télécharger le **QR code** si besoin.

### Règles à connaître

- **Une question qui a déjà des réponses n'est jamais supprimée** : elle est masquée et reste visible dans l'admin avec ses réponses.
- Chaque question a un **identifiant technique** qui ne change jamais : c'est lui qui relie les réponses à la question. On peut donc corriger un intitulé sans rien perdre.
- Si on renomme une réponse possible, les réponses déjà reçues gardent l'ancien libellé.
- **Jour et heure (plages)**, utilisé pour l'arrivée des bénévoles : on liste les jours proposés, chacun avec ses heures possibles (par exemple mercredi de 7h à 9h). Le formulaire refuse une heure hors plage.
- **Conditions d'affichage** : « afficher seulement si… » porte sur une question placée avant. Exemple : l'heure du train aller ne s'affiche que si « Je n'ai pas besoin de la navette à l'aller » n'est pas cochée. Une question masquée par une condition n'est ni demandée ni enregistrée.
- Mise en forme des textes : `**gras**`. Les liens `https://…` et les adresses e-mail deviennent cliquables tout seuls.

---

## 3. Pendant les inscriptions : les réponses

Onglet **Réponses** :

- **Compteurs** : total, aujourd'hui, 7 derniers jours. Les réponses arrivent en direct.
- **Recherche** (nom, e-mail, ville…) et **« Reçues depuis le »**, pratique pour ne reporter dans KBS que les nouvelles.
- **Synthèse** : décompte par réponse, par exemple par domaine d'aide, par jour d'arrivée, ou le nombre de personnes sans besoin de navette à l'aller.
- **×2** à côté d'un e-mail : cette adresse a répondu plusieurs fois (doublon ou correction).
- Cliquer sur une ligne pour voir la réponse complète :
  - **Copier le texte** (pour une note KBS) ;
  - **Supprimer** (doublon, test).
- **Exporter en CSV** : le fichier s'ouvre dans Excel (colonnes séparées, accents corrects). Seules les lignes affichées sont exportées.

Côté participant :

- la réponse en cours est gardée **7 jours sur son appareil** s'il ferme la page ;
- après l'envoi, il voit un récapitulatif, qu'il peut imprimer ou enregistrer en PDF ;
- il n'y a pas d'e-mail de confirmation : les lettres KBS s'en chargent.

---

## 4. Après l'événement (RGPD)

1. Vérifier que tout est reporté dans KBS. Exporter en CSV seulement si une trace doit être gardée.
2. Dans l'onglet **Réglages**, cliquer sur **Supprimer toutes les réponses**, puis taper `SUPPRIMER` pour confirmer. Les questions sont gardées : elles pourront être reprises pour le prochain événement.

La mention RGPD affichée en bas du formulaire annonce cette suppression. Elle se modifie dans **Questions → Textes du formulaire**.

---

## 5. Mot de passe perdu

Le mot de passe ne peut pas être retrouvé, mais on peut en créer un nouveau.
Il faut un accès à la console Firebase. Les questions et les réponses ne sont pas touchées.

1. Console Firebase → **Authentication → Utilisateurs** : supprimer le compte `admin-navettes@kmcfrance.github.io`, ou `admin-benevolat@…` selon l'outil.
2. **Authentication → Paramètres → Actions des utilisateurs** : **recocher temporairement** « Activer la création (inscription) ».
3. Sur la page d'admin de l'outil, cliquer sur **Première utilisation**, créer le nouveau mot de passe et le noter.
4. **Décocher de nouveau** « Activer la création (inscription) ».

Ces comptes techniques ne reçoivent aucun e-mail : les adresses n'existent pas vraiment.

Pour **changer** un mot de passe connu : admin → **Réglages** → mot de passe actuel + nouveau.

---

## 6. Sécurité : ce que garantissent les règles

Les règles sont dans [`firestore-formulaires.rules`](firestore-formulaires.rules).

- **Tout le monde** peut lire les questions publiées (et le brouillon) : aucune donnée personnelle n'y figure.
- **Tout le monde** peut envoyer une réponse, mais seulement quand le formulaire est **ouvert** et entre ses dates d'ouverture et de fermeture. Le contrôle est fait par Firebase lui-même : un envoi après la date limite est refusé même si la page était restée ouverte.
- Seul **l'admin de l'outil** (navettes ou bénévolat) peut lire ou supprimer les réponses de son outil et modifier ses questions.
- **Personne** ne peut modifier une réponse déjà envoyée.

Limites connues :

- La fiche événement est publique, donc la clé Firebase aussi. C'est normal pour Firebase, et ce sont les règles qui protègent les données.
- Un robot pourrait envoyer beaucoup de fausses réponses pendant que le formulaire est ouvert. Le formulaire contient un piège à robots simple. En cas d'abus, activer App Check (voir 1.6) et supprimer les fausses réponses dans l'admin.

---

## 7. Fichiers

| Fichier | Rôle |
|---|---|
| `/commun/formulaires.js` | Moteur commun : affichage, validation, conditions, CSV, dates en heure de Paris |
| `/commun/formulaires-admin.js` | Page d'admin (commune aux deux outils) |
| `/commun/formulaires.css` | Styles (clair et sombre), aux couleurs de la charte de l'événement |
| `/commun/firestore-formulaires.rules` | Règles de sécurité à coller dans Firebase |
| `/commun/qrcode.js` | Générateur de QR code (licence MIT) |
| `/navettes/`, `/benevolat/` | `index.html` (public), `admin.html`, `modele.js` (questions de départ) |

Données dans Firestore :

- `evenements/<id>/formulaires/<outil>` : `brouillon`, `publie` (avec `version`), `ouverture` ;
- `…/reponses/<id>` : `{ r: { <identifiant de question>: valeur }, lang, cree, v }`.

Les réponses à choix gardent le libellé **français**, même si le participant a répondu en anglais : l'export reste homogène.

Pour ajouter un troisième formulaire plus tard (covoiturage, besoins particuliers…) :

1. copier le dossier `navettes/` sous un autre nom et adapter `modele.js` ;
2. ajouter le nom dans `F.OUTILS` (formulaires.js) et dans `outilConnu()` (règles) ;
3. ajouter la tuile dans le hub.
