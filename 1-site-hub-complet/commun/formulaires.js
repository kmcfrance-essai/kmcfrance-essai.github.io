/* =========================================================
   formulaires.js — moteur commun des formulaires (CMK France)
   Utilisé par /navettes/ et /benevolat/ (pages publiques et admins).

   Données (Firestore, projet indiqué dans la fiche : formulaires.firebase) :
     evenements/<evt>/formulaires/<outil>              configuration
         .brouillon   questions et textes en cours de modification (admin)
         .publie      version en ligne (ce que voient les participants)
         .ouverture   { ouvert, debut, fin, debutTs, finTs }
     evenements/<evt>/formulaires/<outil>/reponses/<id>  une réponse
         { r: { <idQuestion>: valeur }, lang, cree, v }

   Les règles de sécurité : /commun/firestore-formulaires.rules
   Mode d'emploi et mise en place : /commun/FORMULAIRES.md

   Dépend de : /commun/fiche.js (Fiche) et du SDK Firebase « compat » 10.12.0.
   ========================================================= */
(function (global) {
  'use strict';

  var F = {};
  F.VERSION = 'Formulaires v1 · 25/09/2026';
  F.OUTILS = { navettes: { fr: 'Navettes', en: 'Shuttles' }, benevolat: { fr: 'Bénévolat', en: 'Volunteering' } };
  /* Compte technique de l'admin d'un outil (jamais affiché aux participants, aucun e-mail n'y est envoyé) */
  F.emailAdmin = function (outil) { return 'admin-' + outil + '@kmcfrance.github.io'; };
  F.LIMITES = { texte: 300, paragraphe: 3000, questions: 60 };
  F.RE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;

  /* ---------------------------------------------------------
     1. Utilitaires
     --------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Texte bilingue { fr, en } : la langue demandée, sinon le français */
  function t(o, lang) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    var v = o[lang || 'fr'];
    if (v != null && String(v).trim() !== '') return String(v);
    return String(o.fr || o.en || '');
  }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function uid(prefixe) { return (prefixe || 'q') + Math.random().toString(36).slice(2, 8); }
  /* el('div', { class: 'x', text: '…', onclick: fn }, [enfants]) */
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'required' || k === 'readOnly') n[k] = !!v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    ajouter(n, enfants);
    return n;
  }
  function ajouter(n, enfants) {
    if (enfants == null) return;
    (Array.isArray(enfants) ? enfants : [enfants]).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  /* Mise en forme minimale des textes saisis dans l'admin :
     retours à la ligne, **gras**, liens https://… et adresses e-mail cliquables. */
  function mini(s) {
    s = String(s == null ? '' : s);
    var gras = function (x) { return esc(x).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>'); };
    var re = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, h = '', i = 0, m;
    while ((m = re.exec(s))) {
      h += gras(s.slice(i, m.index));
      h += m[1] ? '<a href="' + esc(m[1]) + '" target="_blank" rel="noopener">' + esc(m[1]) + '</a>' : '<a href="mailto:' + esc(m[2]) + '">' + esc(m[2]) + '</a>';
      i = re.lastIndex;
    }
    return (h + gras(s.slice(i))).replace(/\r?\n/g, '<br>');
  }
  function nombre(x) { return Number(String(x).replace(',', '.')); }
  function stockage(action, cle, valeur) {
    try {
      if (action === 'lire') return JSON.parse(localStorage.getItem(cle) || 'null');
      if (action === 'ecrire') localStorage.setItem(cle, JSON.stringify(valeur));
      if (action === 'effacer') localStorage.removeItem(cle);
    } catch (e) { return null; }
    return null;
  }

  /* ---------------------------------------------------------
     2. Dates et heures (toujours en heure de Paris)
     --------------------------------------------------------- */
  var JOURS = { fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
  var MOIS = { fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
  var RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var RE_HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  var RE_DH = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

  function dateValide(s) {
    var m = RE_DATE.exec(s || ''); if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function heureValide(s) { return RE_HEURE.test(s || ''); }
  function dateHeureValide(s) { var m = RE_DH.exec(s || ''); return !!m && dateValide(s.slice(0, 10)); }
  /* Jour de la semaine d'une date 'AAAA-MM-JJ' (calcul en UTC : indépendant du fuseau) */
  function jourSemaine(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function jourTexte(iso, lang, sansJour) {
    if (!dateValide(iso)) return iso || '';
    lang = lang === 'en' ? 'en' : 'fr';
    var p = iso.split('-').map(Number), j = JOURS[lang][jourSemaine(iso)], m = MOIS[lang][p[1] - 1];
    if (lang === 'en') return (sansJour ? '' : j + ' ') + p[2] + ' ' + m;
    return (sansJour ? '' : j + ' ') + (p[2] === 1 ? '1er' : p[2]) + ' ' + m;
  }
  function heureTexte(h, lang) {
    if (!heureValide(h)) return h || '';
    if (lang === 'en') return h;
    var p = h.split(':'); return p[0].replace(/^0(?=\d)/, '') + 'h' + (p[1] !== '00' ? p[1] : '');
  }
  function dateHeureTexte(s, lang) {
    if (!dateHeureValide(s)) return s || '';
    return jourTexte(s.slice(0, 10), lang) + (lang === 'en' ? ' at ' : ' à ') + heureTexte(s.slice(11, 16), lang);
  }
  function decalerJour(iso, n) {
    var p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  /* Décalage (minutes) de l'heure de Paris par rapport à UTC à un instant donné */
  function decalageParis(date) {
    try {
      var parts = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(date).forEach(function (x) { parts[x.type] = x.value; });
      var h = +parts.hour === 24 ? 0 : +parts.hour;
      var enUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, +parts.minute, +parts.second);
      return Math.round((enUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    } catch (e) { return -date.getTimezoneOffset(); }
  }
  /* 'AAAA-MM-JJTHH:MM' (heure de Paris) → instant (Date) */
  function parisVersDate(s) {
    var p = s.split(/[-T:]/).map(Number);
    var brut = Date.UTC(p[0], p[1] - 1, p[2], p[3] || 0, p[4] || 0);
    var dec = decalageParis(new Date(brut));
    var d = new Date(brut - dec * 60000);
    var dec2 = decalageParis(d);
    if (dec2 !== dec) d = new Date(brut - dec2 * 60000);
    return d;
  }
  /* instant (Date) → 'AAAA-MM-JJTHH:MM' en heure de Paris */
  function dateVersParis(d) {
    var x = new Date(d.getTime() + decalageParis(d) * 60000);
    return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0') +
      'T' + String(x.getUTCHours()).padStart(2, '0') + ':' + String(x.getUTCMinutes()).padStart(2, '0');
  }
  /* « 25/09/2026 14:05 » (heure de Paris) */
  function horodatage(d) {
    if (!d) return '';
    var s = dateVersParis(d);
    return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + ' ' + s.slice(11, 16);
  }

  /* État d'ouverture d'un formulaire (ouverture = { ouvert, debut, fin }) */
  function etatOuverture(o, maintenant) {
    maintenant = maintenant || new Date();
    if (!o || !o.ouvert) return { etat: 'ferme' };
    if (o.debut && dateHeureValide(o.debut) && maintenant < parisVersDate(o.debut)) return { etat: 'bientot', date: o.debut };
    if (o.fin && dateHeureValide(o.fin) && maintenant >= parisVersDate(o.fin)) return { etat: 'termine', date: o.fin };
    return { etat: 'ouvert', fin: o.fin && dateHeureValide(o.fin) ? o.fin : '' };
  }

  /* ---------------------------------------------------------
     3. Types de questions
     --------------------------------------------------------- */
  var TYPES = {
    section: { nom: 'Titre de partie', desc: 'Un titre et un texte, sans réponse', reponse: false },
    texte: { nom: 'Texte court', desc: 'Une ligne (nom, ville, horaire…)', reponse: true },
    paragraphe: { nom: 'Paragraphe', desc: 'Un texte long (commentaire…)', reponse: true },
    email: { nom: 'E-mail', desc: 'Adresse e-mail vérifiée', reponse: true },
    tel: { nom: 'Téléphone', desc: 'Numéro de téléphone', reponse: true },
    choix: { nom: 'Choix unique', desc: 'Une seule réponse parmi une liste', reponse: true, options: true },
    liste: { nom: 'Liste déroulante', desc: 'Une réponse dans un menu', reponse: true, options: true },
    cases: { nom: 'Cases à cocher', desc: 'Plusieurs réponses possibles', reponse: true, options: true, bornes: 'nombre' },
    case: { nom: 'Case à cocher seule', desc: 'Oui / non (ex. « pas besoin de l\'aller »)', reponse: true },
    date: { nom: 'Date', desc: 'Un jour, avec dates limites possibles', reponse: true, bornes: 'date' },
    heure: { nom: 'Heure', desc: 'Une heure, avec heures limites possibles', reponse: true, bornes: 'heure' },
    jourheure: { nom: 'Jour et heure (plages)', desc: 'Jours autorisés, chacun avec ses heures', reponse: true },
    nombre: { nom: 'Nombre', desc: 'Un nombre, avec minimum et maximum', reponse: true, bornes: 'nombre' }
  };
  var AUTRE_ID = '_autre';
  var AUTRE = { fr: 'Autre', en: 'Other' };
  var OPERATEURS = {
    egal: 'est', different: 'n\'est pas', coche: 'est cochée', pasCoche: 'n\'est pas cochée', rempli: 'a une réponse', vide: 'n\'a pas de réponse'
  };

  /* ---------------------------------------------------------
     4. Messages (participants)
     --------------------------------------------------------- */
  var M = {
    fr: {
      requis: 'Cette réponse est obligatoire.', requisCase: 'Veuillez cocher cette case.', requisChoix: 'Veuillez choisir une réponse.',
      email: 'Adresse e-mail invalide (exemple : prenom.nom@exemple.fr).', tel: 'Numéro de téléphone invalide.',
      nombre: 'Indiquez un nombre.', nombreMin: 'Le minimum est {n}.', nombreMax: 'Le maximum est {n}.',
      date: 'Date invalide.', dateMin: 'Choisissez une date à partir du {d}.', dateMax: 'Choisissez une date jusqu\'au {d}.',
      heure: 'Heure invalide (format HH:MM).', heureMin: 'Choisissez une heure à partir de {h}.', heureMax: 'Choisissez une heure jusqu\'à {h}.',
      jour: 'Choisissez un jour.', jourHeure: 'Indiquez l\'heure.', plage: 'Ce jour-là, l\'heure doit être entre {de} et {a}.', jourInconnu: 'Ce jour n\'est plus proposé : choisissez-en un autre.',
      option: 'Cette réponse n\'est plus proposée : choisissez-en une autre.', autre: 'Précisez votre réponse.',
      casesMin: 'Cochez au moins {n} réponse(s).', casesMax: 'Cochez au plus {n} réponse(s).', long: 'Texte trop long ({n} caractères au maximum).',
      obligatoire: 'obligatoire', noteRequis: 'Les questions marquées d\'un * sont obligatoires.',
      choisir: '— Choisir —', choisirJour: '— Choisir le jour —', autreQuoi: 'Précisez…', jourLbl: 'Jour', heureLbl: 'Heure',
      plageTxt: 'entre {de} et {a}', envoyer: 'Envoyer', envoi: 'Envoi en cours…',
      erreurs: 'Merci de corriger {n} point(s) avant d\'envoyer :', erreur1: 'Merci de corriger ce point avant d\'envoyer :',
      merci: 'Merci, votre réponse est bien enregistrée.', vosReponses: 'Vos réponses', imprimer: 'Imprimer ou enregistrer en PDF', autreReponse: 'Envoyer une autre réponse',
      echecFerme: 'Le formulaire vient d\'être fermé : votre réponse n\'a pas pu être enregistrée.', echecReseau: 'Envoi impossible : vérifiez votre connexion internet puis réessayez. Vos réponses sont conservées sur cette page.', echec: 'L\'envoi a échoué. Réessayez dans un instant. Vos réponses sont conservées sur cette page.',
      reprise: 'Nous avons retrouvé une réponse commencée sur cet appareil.', effacer: 'Tout effacer',
      vide: 'Merci de répondre à au moins une question.', lent: 'L\'envoi prend du temps (connexion lente ou coupée). Ne fermez pas cette page : il se terminera dès que la connexion reviendra.',
      oui: 'Oui', non: 'Non', ecrire: 'Écrire à', jusquau: 'Réponses jusqu\'au {d}',
      ferme: 'Ce formulaire est fermé.', bientot: 'Ce formulaire ouvrira le {d}.', termine: 'Ce formulaire est fermé depuis le {d}.',
      indispo: 'Ce formulaire n\'est pas encore disponible.', introuvable: 'Formulaire introuvable.', chargementEchec: 'Impossible de charger le formulaire. Vérifiez votre connexion puis rechargez la page.',
      contact: 'Une question ? Écrivez à {c}.', apercu: 'Aperçu : rien n\'a été envoyé.', chargement: 'Chargement…', a: 'à',
      test: 'Version de test : ce formulaire n\'est pas encore utilisé pour les inscriptions.'
    },
    en: {
      requis: 'This answer is required.', requisCase: 'Please tick this box.', requisChoix: 'Please choose an answer.',
      email: 'Invalid e-mail address (example: firstname.lastname@example.com).', tel: 'Invalid phone number.',
      nombre: 'Please enter a number.', nombreMin: 'The minimum is {n}.', nombreMax: 'The maximum is {n}.',
      date: 'Invalid date.', dateMin: 'Please choose a date from {d}.', dateMax: 'Please choose a date up to {d}.',
      heure: 'Invalid time (HH:MM).', heureMin: 'Please choose a time from {h}.', heureMax: 'Please choose a time up to {h}.',
      jour: 'Please choose a day.', jourHeure: 'Please enter the time.', plage: 'On that day, the time must be between {de} and {a}.', jourInconnu: 'This day is no longer available: please choose another one.',
      option: 'This answer is no longer available: please choose another one.', autre: 'Please specify.',
      casesMin: 'Tick at least {n} answer(s).', casesMax: 'Tick at most {n} answer(s).', long: 'Text too long ({n} characters maximum).',
      obligatoire: 'required', noteRequis: 'Questions marked with * are required.',
      choisir: '— Choose —', choisirJour: '— Choose the day —', autreQuoi: 'Please specify…', jourLbl: 'Day', heureLbl: 'Time',
      plageTxt: 'between {de} and {a}', envoyer: 'Submit', envoi: 'Sending…',
      erreurs: 'Please correct {n} item(s) before submitting:', erreur1: 'Please correct this item before submitting:',
      merci: 'Thank you, your answer has been recorded.', vosReponses: 'Your answers', imprimer: 'Print or save as PDF', autreReponse: 'Submit another answer',
      echecFerme: 'The form has just been closed: your answer could not be recorded.', echecReseau: 'Could not send: please check your internet connection and try again. Your answers are kept on this page.', echec: 'Sending failed. Please try again in a moment. Your answers are kept on this page.',
      reprise: 'We found an answer you started on this device.', effacer: 'Clear all',
      vide: 'Please answer at least one question.', lent: 'Sending is taking a while (slow or lost connection). Do not close this page: it will finish as soon as the connection is back.',
      oui: 'Yes', non: 'No', ecrire: 'Write to', jusquau: 'Answers until {d}',
      ferme: 'This form is closed.', bientot: 'This form will open on {d}.', termine: 'This form has been closed since {d}.',
      indispo: 'This form is not available yet.', introuvable: 'Form not found.', chargementEchec: 'The form could not be loaded. Please check your connection and reload the page.',
      contact: 'Any question? Write to {c}.', apercu: 'Preview: nothing has been sent.', chargement: 'Loading…', a: 'at',
      test: 'Test version: this form is not used for registrations yet.'
    }
  };
  function msg(lang, cle, vars) {
    var s = (M[lang] || M.fr)[cle] || M.fr[cle] || cle;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }

  /* ---------------------------------------------------------
     5. Logique des questions (pure : testable sans navigateur)
     --------------------------------------------------------- */
  function valeurVide(v) {
    return v == null || v === false || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
  }
  function options(q) {
    var o = (q.options || []).slice();
    if (q.autre) o.push({ id: AUTRE_ID, fr: AUTRE.fr, en: AUTRE.en });
    return o;
  }
  /* « Autre » est enregistré sous la forme « Autre : <texte libre> » */
  function estAutre(v) { return typeof v === 'string' && v.indexOf(AUTRE.fr + ' :') === 0; }
  function texteAutre(v) { return estAutre(v) ? v.slice(AUTRE.fr.length + 2).replace(/^ /, '') : ''; }
  /* La valeur v correspond-elle à l'option o ? (les réponses gardent le libellé français) */
  function correspond(v, o) {
    if (!o) return false;
    if (o.id === AUTRE_ID) return v === AUTRE.fr || estAutre(v);
    return v === o.fr;
  }
  function trouverOption(q, v) {
    var os = options(q);
    for (var i = 0; i < os.length; i++) if (correspond(v, os[i])) return os[i];
    return null;
  }
  function parId(qs, id) { for (var i = 0; i < qs.length; i++) if (qs[i].id === id) return qs[i]; return null; }

  /* Une question est-elle affichée, vu les réponses données ? */
  function estVisible(q, rep, qs, prof) {
    if (!q || q.masque) return false;
    var c = q.condition;
    if (!c || !c.q) return true;
    if ((prof || 0) > 30) return true;
    var src = parId(qs, c.q);
    if (!src) return true;                         /* condition cassée : la question reste affichée */
    var v = estVisible(src, rep, qs, (prof || 0) + 1) ? rep[src.id] : undefined;
    var opt = null;
    if (c.o) { var os = options(src); for (var i = 0; i < os.length; i++) if (os[i].id === c.o) opt = os[i]; }
    var dedans = function () {
      if (!opt) return false;
      if (Array.isArray(v)) return v.some(function (x) { return correspond(x, opt); });
      return correspond(v, opt);
    };
    switch (c.op) {
      case 'coche': return v === true;
      case 'pasCoche': return v !== true;
      case 'egal': return dedans();
      case 'different': return !dedans();
      case 'rempli': return !valeurVide(v);
      case 'vide': return valeurVide(v);
    }
    return true;
  }

  /* Réponses à envoyer : seulement les questions affichées, valeurs nettoyées */
  function reponsesVisibles(qs, rep) {
    var out = {};
    qs.forEach(function (q) {
      if (!TYPES[q.type] || !TYPES[q.type].reponse || !estVisible(q, rep, qs)) return;
      var v = rep[q.id];
      if (valeurVide(v)) { if (q.type === 'case') out[q.id] = false; return; }
      if (typeof v === 'string') v = v.trim();
      if (Array.isArray(v)) v = v.map(function (x) { return String(x).trim(); }).filter(Boolean);
      out[q.id] = v;
    });
    return out;
  }

  /* Contrôle des réponses. Retourne { idQuestion: message } (vide si tout va bien) */
  function valider(qs, rep, lang) {
    var err = {};
    var L = function (cle, vars) { return msg(lang, cle, vars); };
    qs.forEach(function (q) {
      var ty = TYPES[q.type];
      if (!ty || !ty.reponse || !estVisible(q, rep, qs)) return;
      var v = rep[q.id];
      if (q.type === 'case') { if (q.requis && v !== true) err[q.id] = L('requisCase'); return; }
      if (q.type === 'jourheure') {
        var s = typeof v === 'string' ? v : '';
        var jour = s.slice(0, 10).trim(), heure = s.slice(11, 16).trim();
        if (!jour && !heure) { if (q.requis) err[q.id] = L('requis'); return; }
        if (!jour) { err[q.id] = L('jour'); return; }
        var plage = (q.jours || []).filter(function (j) { return j.date === jour; })[0];
        if (!plage) { err[q.id] = L('jourInconnu'); return; }
        if (!heure) { err[q.id] = L('jourHeure'); return; }
        if (!heureValide(heure)) { err[q.id] = L('heure'); return; }
        if ((plage.de && heure < plage.de) || (plage.a && heure > plage.a)) err[q.id] = L('plage', { de: heureTexte(plage.de || '00:00', lang), a: heureTexte(plage.a || '23:59', lang) });
        return;
      }
      if (valeurVide(v)) {
        if (q.requis) err[q.id] = (q.type === 'choix' || q.type === 'liste' || q.type === 'cases') ? L('requisChoix') : L('requis');
        return;
      }
      var s2 = Array.isArray(v) ? '' : String(v).trim();
      var max = q.type === 'paragraphe' ? F.LIMITES.paragraphe : F.LIMITES.texte;
      if (!Array.isArray(v) && s2.length > max) { err[q.id] = L('long', { n: max }); return; }
      switch (q.type) {
        case 'email':
          if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(s2)) err[q.id] = L('email');
          break;
        case 'tel':
          if (!/^[0-9 +().\-\/]{6,25}$/.test(s2) || (s2.match(/\d/g) || []).length < 6) err[q.id] = L('tel');
          break;
        case 'nombre':
          var n = Number(s2.replace(',', '.'));
          if (!/^-?\d+([.,]\d+)?$/.test(s2) || isNaN(n)) err[q.id] = L('nombre');
          else if (q.min !== '' && q.min != null && n < nombre(q.min)) err[q.id] = L('nombreMin', { n: q.min });
          else if (q.max !== '' && q.max != null && n > nombre(q.max)) err[q.id] = L('nombreMax', { n: q.max });
          break;
        case 'date':
          if (!dateValide(s2)) err[q.id] = L('date');
          else if (q.min && s2 < q.min) err[q.id] = L('dateMin', { d: jourTexte(q.min, lang) });
          else if (q.max && s2 > q.max) err[q.id] = L('dateMax', { d: jourTexte(q.max, lang) });
          break;
        case 'heure':
          if (!heureValide(s2)) err[q.id] = L('heure');
          else if (q.min && s2 < q.min) err[q.id] = L('heureMin', { h: heureTexte(q.min, lang) });
          else if (q.max && s2 > q.max) err[q.id] = L('heureMax', { h: heureTexte(q.max, lang) });
          break;
        case 'choix': case 'liste':
          var o = trouverOption(q, s2);
          if (!o) err[q.id] = L('option');
          else if (o.id === AUTRE_ID && !texteAutre(s2).trim()) err[q.id] = L('autre');
          break;
        case 'cases':
          var vals = Array.isArray(v) ? v : [v];
          if (vals.some(function (x) { return !trouverOption(q, x); })) { err[q.id] = L('option'); break; }
          if (vals.some(function (x) { var oo = trouverOption(q, x); return oo.id === AUTRE_ID && !texteAutre(x).trim(); })) { err[q.id] = L('autre'); break; }
          if (q.min && vals.length < nombre(q.min)) err[q.id] = L('casesMin', { n: q.min });
          else if (q.max && vals.length > nombre(q.max)) err[q.id] = L('casesMax', { n: q.max });
          break;
      }
    });
    return err;
  }

  /* Valeur lisible d'une réponse */
  function lisible(q, v, lang) {
    lang = lang || 'fr';
    if (v == null || v === '') return '';
    if (!q) return Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? msg(lang, v ? 'oui' : 'non') : String(v);
    var libOpt = function (x) {
      var o = trouverOption(q, x);
      if (!o) return String(x);
      if (o.id === AUTRE_ID) return t(AUTRE, lang) + (texteAutre(x) ? ' : ' + texteAutre(x) : '');
      return t(o, lang);
    };
    switch (q.type) {
      case 'case': return msg(lang, v === true ? 'oui' : 'non');
      case 'cases': return (Array.isArray(v) ? v : [v]).map(libOpt).join(', ');
      case 'choix': case 'liste': return libOpt(v);
      case 'date': return dateValide(v) ? jourTexte(v, lang) : String(v);
      case 'jourheure':
        var j = String(v).slice(0, 10), h = String(v).slice(11, 16);
        return dateValide(j) ? jourTexte(j, lang) + (h ? (lang === 'en' ? ' at ' : ' à ') + heureTexte(h, lang) : '') : String(v);
      case 'heure': return heureTexte(v, lang);
      default: return Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? msg(lang, v ? 'oui' : 'non') : String(v);
    }
  }

  /* Contrôle d'un contenu de formulaire (avant publication, dans l'admin).
     Retourne { erreurs: [..], avertissements: [..] } avec { q: id?, texte } */
  function verifierContenu(c) {
    var E = [], W = [];
    var e = function (q, s) { E.push({ q: q, texte: s }); }, w = function (q, s) { W.push({ q: q, texte: s }); };
    if (!t(c.titre, 'fr').trim()) e(null, 'Le formulaire n\'a pas de titre.');
    var qs = c.questions || [];
    if (qs.length > F.LIMITES.questions) e(null, 'Trop de questions (' + F.LIMITES.questions + ' au maximum).');
    var actives = qs.filter(function (q) { return !q.masque && TYPES[q.type] && TYPES[q.type].reponse; });
    if (!actives.length) e(null, 'Le formulaire n\'a aucune question affichée.');
    var ids = {};
    var manqueEN = 0;
    var compteEN = function (o) { if (o && t(o, 'fr').trim() && !(o.en || '').trim()) manqueEN++; };
    compteEN(c.titre); compteEN(c.intro); compteEN(c.merci); compteEN(c.rgpd);
    qs.forEach(function (q, i) {
      var nom = 'Question ' + (i + 1) + (t(q.label, 'fr') ? ' « ' + t(q.label, 'fr').slice(0, 50) + ' »' : '');
      if (!TYPES[q.type]) { e(q.id, nom + ' : type inconnu (' + q.type + ').'); return; }
      if (!q.id) e(null, nom + ' : identifiant manquant.');
      else if (!F.RE_ID.test(q.id)) e(null, nom + ' : identifiant technique invalide (« ' + q.id + ' » : lettres, chiffres, - et _ seulement).');
      else if (ids[q.id]) e(q.id, nom + ' : identifiant en double (' + q.id + ').');
      ids[q.id] = 1;
      if (!t(q.label, 'fr').trim()) e(q.id, 'Question ' + (i + 1) + ' : l\'intitulé en français est vide.');
      compteEN(q.label); compteEN(q.aide);
      if (TYPES[q.type].options) {
        var os = q.options || [];
        if (!os.length && !q.autre) e(q.id, nom + ' : ajoutez au moins une réponse possible.');
        var vus = {};
        os.forEach(function (o, k) {
          var l = (o.fr || '').trim();
          if (!l) e(q.id, nom + ' : la réponse n° ' + (k + 1) + ' est vide.');
          else if (vus[l.toLowerCase()]) e(q.id, nom + ' : la réponse « ' + l + ' » est en double.');
          else if (l === AUTRE.fr || l.indexOf(AUTRE.fr + ' : ') === 0) e(q.id, nom + ' : « Autre » est réservé : cochez plutôt « Ajouter une réponse Autre ».');
          vus[l.toLowerCase()] = 1;
          compteEN(o);
        });
        if (os.length === 1 && q.type !== 'cases' && !q.autre) w(q.id, nom + ' : une seule réponse possible.');
      }
      if (q.type === 'jourheure') {
        var js = q.jours || [];
        if (!js.length) e(q.id, nom + ' : ajoutez au moins un jour autorisé.');
        var vusJ = {};
        js.forEach(function (j) {
          if (!dateValide(j.date)) e(q.id, nom + ' : un jour autorisé n\'a pas de date valide.');
          else if (vusJ[j.date]) e(q.id, nom + ' : le jour ' + jourTexte(j.date) + ' est en double.');
          vusJ[j.date] = 1;
          if ((j.de && !heureValide(j.de)) || (j.a && !heureValide(j.a))) e(q.id, nom + ' : heure invalide pour le ' + jourTexte(j.date) + '.');
          else if (j.de && j.a && j.de > j.a) e(q.id, nom + ' : le ' + jourTexte(j.date) + ', l\'heure de début est après l\'heure de fin.');
        });
      }
      var b = TYPES[q.type].bornes;
      if (b) {
        var okB = b === 'date' ? dateValide : b === 'heure' ? heureValide : function (x) { return /^-?\d+([.,]\d+)?$/.test(String(x)); };
        if (q.min != null && q.min !== '' && !okB(q.min)) e(q.id, nom + ' : minimum invalide.');
        if (q.max != null && q.max !== '' && !okB(q.max)) e(q.id, nom + ' : maximum invalide.');
        if (q.min != null && q.min !== '' && q.max != null && q.max !== '' && okB(q.min) && okB(q.max)) {
          var avant = b === 'nombre' ? Number(String(q.min).replace(',', '.')) > Number(String(q.max).replace(',', '.')) : q.min > q.max;
          if (avant) e(q.id, nom + ' : le minimum est plus grand que le maximum.');
        }
      }
      if (q.condition && q.condition.q) {
        var src = parId(qs, q.condition.q), pos = qs.indexOf(src);
        if (!src) e(q.id, nom + ' : la condition d\'affichage renvoie à une question supprimée.');
        else if (pos >= i) e(q.id, nom + ' : la condition d\'affichage doit porter sur une question placée avant.');
        else {
          if (src.masque) w(q.id, nom + ' : la condition porte sur une question masquée (la question ne s\'affichera ' + (q.condition.op === 'vide' || q.condition.op === 'pasCoche' || q.condition.op === 'different' ? 'que selon cette règle' : 'jamais') + ').');
          if ((q.condition.op === 'egal' || q.condition.op === 'different') && !options(src).some(function (o) { return o.id === q.condition.o; })) e(q.id, nom + ' : la réponse choisie dans la condition d\'affichage n\'existe plus.');
          if ((q.condition.op === 'coche' || q.condition.op === 'pasCoche') && src.type !== 'case') e(q.id, nom + ' : « cochée » ne s\'applique qu\'à une case à cocher seule.');
        }
      }
      if (q.requis && q.masque) w(q.id, nom + ' : masquée, donc jamais demandée (même si elle est obligatoire).');
    });
    if (manqueEN) w(null, manqueEN + ' texte(s) sans traduction anglaise : la version française sera affichée aux participants anglophones.');
    if (!t(c.rgpd, 'fr').trim()) w(null, 'La mention sur les données personnelles (RGPD) est vide.');
    return { erreurs: E, avertissements: W };
  }

  /* ---------------------------------------------------------
     6. Export CSV (séparateur « ; », UTF-8 avec BOM : s'ouvre dans Excel)
     --------------------------------------------------------- */
  function celluleCSV(v) {
    var s = v == null ? '' : String(v);
    /* protection contre les formules (sauf numéros de téléphone du type +33 6 …) */
    if (/^[=@\t\r]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-][0-9 ().\-\/]*$/.test(s))) s = "'" + s;
    if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  /* colonnes : questions à réponse (y compris masquées), puis clés inconnues */
  function colonnes(qs, reps) {
    var cols = qs.filter(function (q) { return TYPES[q.type] && TYPES[q.type].reponse; });
    var connues = {}; cols.forEach(function (q) { connues[q.id] = 1; });
    var autres = [];
    (reps || []).forEach(function (r) { Object.keys(r.r || {}).forEach(function (k) { if (!connues[k]) { connues[k] = 1; autres.push({ id: k, type: 'texte', label: { fr: k }, inconnue: true }); } }); });
    return cols.concat(autres);
  }
  function csv(qs, reps) {
    var cols = colonnes(qs, reps);
    var lignes = [['Reçue le', 'Langue'].concat(cols.map(function (q) { return t(q.label, 'fr') + (q.masque ? ' (masquée)' : ''); }))];
    reps.forEach(function (r) {
      lignes.push([horodatage(r.cree), (r.lang || 'fr').toUpperCase()].concat(cols.map(function (q) {
        var v = (r.r || {})[q.id];
        return v === undefined ? '' : lisible(q.inconnue ? null : q, v, 'fr');
      })));
    });
    return '﻿' + lignes.map(function (l) { return l.map(celluleCSV).join(';'); }).join('\r\n') + '\r\n';
  }
  function telecharger(nom, contenu, type) {
    var b = contenu instanceof Blob ? contenu : new Blob([contenu], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  /* ---------------------------------------------------------
     7. Firebase
     --------------------------------------------------------- */
  function configFirebase(fiche) {
    var c = fiche && fiche.formulaires && fiche.formulaires.firebase;
    return c && c.apiKey && c.projectId && c.appId ? c : null;
  }
  /* Une application Firebase par usage : l'admin navettes et l'admin bénévolat
     gardent chacun leur connexion dans le même navigateur. */
  function connecter(fiche, nom) {
    var cfg = configFirebase(fiche);
    if (!cfg) return null;
    if (!global.firebase || !global.firebase.initializeApp) throw new Error('Le module Firebase ne s\'est pas chargé (connexion internet ?).');
    var fb = global.firebase, app = null;
    (fb.apps || []).forEach(function (a) { if (a.name === nom) app = a; });
    if (!app) app = fb.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, storageBucket: cfg.storageBucket, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId }, nom);
    return { app: app, db: app.firestore(), auth: typeof app.auth === 'function' ? app.auth() : null, fb: fb };
  }
  function chemin(evt, outil) { return 'evenements/' + evt + '/formulaires/' + outil; }
  function codeErreur(e) { return (e && (e.code || e.name)) || ''; }

  /* ---------------------------------------------------------
     8. Affichage d'un formulaire (page publique et aperçu de l'admin)
     opts : { lang, apercu, envoyer(reponses, lang) → Promise, cleBrouillon, contact }
     --------------------------------------------------------- */
  function rendreFormulaire(zone, contenu, opts) {
    opts = opts || {};
    var lang = opts.lang === 'en' ? 'en' : 'fr';
    var qs = (contenu.questions || []).filter(function (q) { return TYPES[q.type]; });
    var rep = opts.etat || {};                /* réponses en cours (partagées lors d'un changement de langue) */
    var tente = false;                        /* une tentative d'envoi a eu lieu : validation en direct */
    var debut = opts.debut || Date.now();   /* heure d'arrivée sur la page (anti-robot) */
    var repris = false;
    var L = function (cle, vars) { return msg(lang, cle, vars); };
    var blocs = {};
    zone.innerHTML = '';

    if (opts.reprise && opts.cleBrouillon) {
      var sauve = stockage('lire', opts.cleBrouillon);
      if (sauve && sauve.rep && Date.now() - (sauve.quand || 0) < 7 * 86400000 && Object.keys(sauve.rep).length) {
        repris = true;
        Object.keys(sauve.rep).forEach(function (k) { rep[k] = sauve.rep[k]; });
        var bandeau = el('div', { class: 'note no-print', role: 'status' }, [
          el('span', { text: L('reprise') + ' ' }),
          el('button', { class: 'btn-link', type: 'button', text: L('effacer'), onclick: function () {
            stockage('effacer', opts.cleBrouillon);
            Object.keys(rep).forEach(function (k) { delete rep[k]; });
            rendreFormulaire(zone, contenu, Object.assign({}, opts, { etat: rep, reprise: false }));
          } })
        ]);
        zone.appendChild(bandeau);
      }
    }
    var memo = null;
    function memoriser() {
      if (!opts.cleBrouillon) return;
      clearTimeout(memo);
      memo = setTimeout(function () { stockage('ecrire', opts.cleBrouillon, { quand: Date.now(), rep: rep }); }, 400);
    }

    if (t(contenu.intro, lang).trim()) zone.appendChild(el('div', { class: 'card intro' }, [el('p', { html: mini(t(contenu.intro, lang)) })]));
    var resume = el('div', { class: 'resume-err', tabindex: '-1', hidden: true, role: 'alert' });
    zone.appendChild(resume);
    if (qs.some(function (q) { return q.requis && !q.masque; })) zone.appendChild(el('p', { class: 'req-note', html: esc(L('noteRequis')).replace('*', '<span class="req" aria-hidden="true">*</span>') }));

    var form = el('form', { class: 'fx', novalidate: true });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); soumettre(); });
    zone.appendChild(form);

    qs.forEach(function (q) {
      if (q.masque) return;
      var b = q.type === 'section' ? rendreSection(q) : rendreQuestion(q);
      blocs[q.id] = b;
      form.appendChild(b);
    });

    /* piège à robots : un champ invisible que les humains ne remplissent pas */
    var hp = el('div', { class: 'hp', 'aria-hidden': 'true' }, [el('label', { for: 'fx-piege', text: 'Ne pas remplir' }), el('input', { type: 'text', id: 'fx-piege', name: 'fx_ne_pas_remplir', tabindex: '-1', autocomplete: 'new-password' })]);
    form.appendChild(hp);
    if (t(contenu.rgpd, lang).trim()) form.appendChild(el('p', { class: 'rgpd', html: mini(t(contenu.rgpd, lang)) }));
    var btn = el('button', { class: 'btn btn-c', type: 'submit', text: L('envoyer') });
    var echec = el('p', { class: 'msg ko', role: 'alert', hidden: true });
    form.appendChild(el('div', { class: 'envoi' }, [btn, echec]));
    majVisibilite();

    function idc(q) { return 'fx-' + q.id; }
    function rendreSection(q) {
      var s = el('div', { class: 'fsec', 'data-q': q.id });
      s.appendChild(el('h2', { text: t(q.label, lang) }));
      if (t(q.aide, lang).trim()) s.appendChild(el('p', { html: mini(t(q.aide, lang)) }));
      return s;
    }
    function titreQ(q) {
      var h = esc(t(q.label, lang));
      if (q.requis) h += ' <span class="req" aria-hidden="true">*</span><span class="sr"> (' + esc(L('obligatoire')) + ')</span>';
      return h;
    }
    function rendreQuestion(q) {
      var b = el('div', { class: 'card fq fq-' + q.type, 'data-q': q.id, id: 'bloc-' + q.id });
      var aide = t(q.aide, lang).trim() ? el('p', { class: 'fq-aide', id: 'aide-' + q.id, html: mini(t(q.aide, lang)) }) : null;
      var err = el('p', { class: 'fq-err', id: 'err-' + q.id, hidden: true });
      var decrit = (aide ? 'aide-' + q.id + ' ' : '') + 'err-' + q.id;
      var v = rep[q.id];
      var champ = function (attrs) {
        var a = Object.assign({ id: idc(q), name: q.id, 'aria-describedby': decrit }, attrs);
        if (q.requis) a['aria-required'] = 'true';
        return a;
      };
      var surSaisie = function (val) { rep[q.id] = val; memoriser(); apresChangement(q); };

      if (q.type === 'choix' || q.type === 'cases') {
        var fs = el('fieldset', { 'aria-describedby': decrit, role: q.type === 'choix' ? 'radiogroup' : 'group', 'aria-required': q.requis && q.type === 'choix' ? 'true' : null });
        fs.appendChild(el('legend', { html: titreQ(q) }));
        if (aide) fs.appendChild(aide);
        var box = el('div', { class: 'opts' });
        var multi = q.type === 'cases';
        var courant = multi ? (Array.isArray(v) ? v.slice() : []) : v;
        var champAutre = null;
        options(q).forEach(function (o, k) {
          var idO = idc(q) + '-' + k;
          var coche = multi ? courant.some(function (x) { return correspond(x, o); }) : correspond(courant, o);
          var inp = el('input', { type: multi ? 'checkbox' : 'radio', name: q.id, id: idO, value: o.id === AUTRE_ID ? AUTRE.fr : o.fr, checked: coche, 'aria-describedby': decrit });
          var lab = el('label', { class: 'opt', for: idO }, [inp, el('span', { text: t(o, lang) })]);
          if (o.id === AUTRE_ID) {
            champAutre = el('input', { type: 'text', 'aria-label': t(q.label, lang) + ' — ' + L('autreQuoi'), placeholder: L('autreQuoi'), maxlength: '200', value: coche ? texteAutre(multi ? courant.filter(estAutre)[0] || '' : courant) : '' });
            champAutre.addEventListener('input', function () { inp.checked = true; lire(); });
            box.appendChild(el('div', { class: 'opt-autre' }, [lab, champAutre]));
          } else box.appendChild(lab);
          inp.addEventListener('change', lire);
        });
        function lire() {
          var cochees = Array.prototype.filter.call(box.querySelectorAll('input[type=checkbox],input[type=radio]'), function (i) { return i.checked; });
          var vals = cochees.map(function (i) { return i.value === AUTRE.fr ? AUTRE.fr + ' : ' + (champAutre ? champAutre.value : '') : i.value; });
          surSaisie(multi ? vals : (vals[0] || ''));
        }
        fs.appendChild(box);
        b.appendChild(fs);
      } else if (q.type === 'case') {
        var inpC = el('input', champ({ type: 'checkbox', checked: v === true }));
        inpC.addEventListener('change', function () { surSaisie(inpC.checked); });
        b.appendChild(el('label', { class: 'opt', for: idc(q) }, [inpC, el('span', { html: titreQ(q) })]));
        if (aide) b.appendChild(aide);
      } else if (q.type === 'liste') {
        b.appendChild(el('label', { class: 'fq-l', for: idc(q), html: titreQ(q) }));
        if (aide) b.appendChild(aide);
        var sel = el('select', champ({}));
        sel.appendChild(el('option', { value: '', text: L('choisir') }));
        var champAutreL = null;
        options(q).forEach(function (o) {
          var val = o.id === AUTRE_ID ? AUTRE.fr : o.fr;
          sel.appendChild(el('option', { value: val, text: t(o, lang), selected: correspond(v, o) }));
        });
        b.appendChild(sel);
        if (q.autre) {
          champAutreL = el('input', { type: 'text', 'aria-label': t(q.label, lang) + ' — ' + L('autreQuoi'), placeholder: L('autreQuoi'), maxlength: '200', value: texteAutre(v), hidden: !(estAutre(v) || v === AUTRE.fr) });
          champAutreL.addEventListener('input', lireL);
          b.appendChild(champAutreL);
        }
        sel.addEventListener('change', lireL);
        function lireL() {
          if (champAutreL) champAutreL.hidden = sel.value !== AUTRE.fr;
          surSaisie(sel.value === AUTRE.fr ? AUTRE.fr + ' : ' + (champAutreL ? champAutreL.value : '') : sel.value);
        }
      } else if (q.type === 'jourheure') {
        var fsj = el('fieldset', { 'aria-describedby': decrit });
        fsj.appendChild(el('legend', { html: titreQ(q) }));
        if (aide) fsj.appendChild(aide);
        var jours = (q.jours || []).filter(function (j) { return dateValide(j.date); });
        var jv = typeof v === 'string' ? v.slice(0, 10).trim() : '', hv = typeof v === 'string' ? v.slice(11, 16).trim() : '';
        var selJ = el('select', { id: idc(q), name: q.id + '-jour', 'aria-describedby': decrit, 'aria-required': q.requis ? 'true' : null });
        selJ.appendChild(el('option', { value: '', text: L('choisirJour') }));
        jours.forEach(function (j) {
          var plageTxt = (j.de || j.a) ? ' (' + L('plageTxt', { de: heureTexte(j.de || '00:00', lang), a: heureTexte(j.a || '23:59', lang) }) + ')' : '';
          selJ.appendChild(el('option', { value: j.date, text: jourTexte(j.date, lang) + plageTxt, selected: j.date === jv }));
        });
        var inpH = el('input', { type: 'time', id: idc(q) + '-h', name: q.id + '-heure', step: '60', value: hv, class: 'court', 'aria-describedby': decrit, 'aria-required': q.requis ? 'true' : null });
        var bornes = function () {
          var j = jours.filter(function (x) { return x.date === selJ.value; })[0];
          if (j && j.de) inpH.min = j.de; else inpH.removeAttribute('min');
          if (j && j.a) inpH.max = j.a; else inpH.removeAttribute('max');
        };
        bornes();
        var lireJ = function () { bornes(); surSaisie(selJ.value || inpH.value ? (selJ.value || '          ') + ' ' + inpH.value : ''); };
        selJ.addEventListener('change', lireJ);
        inpH.addEventListener('input', lireJ);
        inpH.addEventListener('change', lireJ);
        fsj.appendChild(el('div', { class: 'jh' }, [
          el('div', null, [el('label', { for: idc(q), text: L('jourLbl') }), selJ]),
          el('div', null, [el('label', { for: idc(q) + '-h', text: L('heureLbl') }), inpH])
        ]));
        b.appendChild(fsj);
      } else {
        b.appendChild(el('label', { class: 'fq-l', for: idc(q), html: titreQ(q) }));
        if (aide) b.appendChild(aide);
        var inp2;
        if (q.type === 'paragraphe') inp2 = el('textarea', champ({ maxlength: String(F.LIMITES.paragraphe), rows: '4' }));
        else {
          var typeHTML = { texte: 'text', email: 'email', tel: 'tel', date: 'date', heure: 'time', nombre: 'text' }[q.type] || 'text';
          var a = { type: typeHTML, maxlength: String(F.LIMITES.texte) };
          if (q.type === 'email') { a.autocomplete = 'email'; a.inputmode = 'email'; a.spellcheck = 'false'; }
          if (q.type === 'tel') { a.autocomplete = 'tel'; a.inputmode = 'tel'; }
          if (q.type === 'nombre') { a.inputmode = 'decimal'; a['class'] = 'court'; }
          if (q.type === 'date' || q.type === 'heure') { a['class'] = 'court'; if (q.min) a.min = q.min; if (q.max) a.max = q.max; delete a.maxlength; }
          if (q.type === 'heure') a.step = '60';
          if (q.auto) a.autocomplete = q.auto;
          inp2 = el('input', champ(a));
        }
        inp2.value = typeof v === 'string' ? v : '';
        inp2.addEventListener('input', function () { surSaisie(inp2.value); });
        inp2.addEventListener('change', function () { surSaisie(inp2.value); });
        b.appendChild(inp2);
      }
      b.appendChild(err);
      return b;
    }

    function majVisibilite() {
      qs.forEach(function (q) { if (blocs[q.id]) blocs[q.id].hidden = !estVisible(q, rep, qs); });
    }
    function montrerErreur(q, m) {
      var b = blocs[q.id]; if (!b) return;
      var e = document.getElementById('err-' + q.id) || b.querySelector('.fq-err');
      e.textContent = m || ''; e.hidden = !m;
      b.classList.toggle('err', !!m);
      Array.prototype.forEach.call(b.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea,fieldset,input[type=checkbox]'), function (i) {
        if (i.closest('.hp')) return;
        if (i.type === 'checkbox' && q.type !== 'case') return;
        if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
      });
    }
    function apresChangement(q) {
      majVisibilite();
      if (tente) {
        var errs = valider(qs, rep, lang);
        qs.forEach(function (x) { if (blocs[x.id] && TYPES[x.type].reponse) montrerErreur(x, errs[x.id]); });
        if (!Object.keys(errs).length) resume.hidden = true;
      }
    }
    function soumettre() {
      tente = true;
      echec.hidden = true;
      var errs = valider(qs, rep, lang);
      var liste = qs.filter(function (q) { return errs[q.id] && blocs[q.id]; });
      qs.forEach(function (q) { if (blocs[q.id] && TYPES[q.type].reponse) montrerErreur(q, errs[q.id]); });
      if (liste.length) {
        resume.innerHTML = '';
        resume.appendChild(el('h2', { text: liste.length > 1 ? L('erreurs', { n: liste.length }) : L('erreur1') }));
        resume.appendChild(el('ul', null, liste.map(function (q) {
          return el('li', null, [el('a', { href: '#bloc-' + q.id, text: t(q.label, lang), onclick: function (ev) {
            ev.preventDefault();
            var cible = document.getElementById(idc(q)) || blocs[q.id].querySelector('input,select,textarea');
            blocs[q.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (cible) setTimeout(function () { cible.focus({ preventScroll: true }); }, 250);
          } }), el('span', { text: ' — ' + errs[q.id] })]);
        })));
        resume.hidden = false;
        resume.scrollIntoView({ behavior: 'smooth', block: 'start' });
        resume.focus({ preventScroll: true });
        return;
      }
      resume.hidden = true;
      var reponses = reponsesVisibles(qs, rep);
      if (!Object.keys(reponses).length) { echec.textContent = L('vide'); echec.hidden = false; return; }
      if (opts.apercu) { merci(reponses, true); return; }
      /* robots : champ piège rempli, ou formulaire envoyé moins de 3 secondes après l'arrivée
         sur la page (sauf réponse reprise sur l'appareil) → on fait semblant */
      if (form.querySelector('#fx-piege').value || (!repris && Date.now() - debut < 3000)) { merci(reponses, false); return; }
      btn.disabled = true; btn.textContent = L('envoi');
      if (opts.pendantEnvoi) opts.pendantEnvoi(true);
      /* hors connexion, Firebase garde l'envoi en attente sans échouer : on prévient la personne */
      var lent = setTimeout(function () { echec.textContent = L('lent'); echec.hidden = false; }, 15000);
      Promise.resolve().then(function () { return opts.envoyer(reponses, lang); }).then(function () {
        clearTimeout(lent);
        if (opts.pendantEnvoi) opts.pendantEnvoi(false);
        if (opts.cleBrouillon) { clearTimeout(memo); stockage('effacer', opts.cleBrouillon); }
        merci(reponses, false);
      }, function (e) {
        clearTimeout(lent);
        if (opts.pendantEnvoi) opts.pendantEnvoi(false);
        btn.disabled = false; btn.textContent = L('envoyer');
        var c = codeErreur(e);
        echec.textContent = c === 'permission-denied' ? L('echecFerme') : (c === 'unavailable' || c === 'deadline-exceeded' || !navigator.onLine) ? L('echecReseau') : L('echec');
        if (c === 'permission-denied' && opts.contact) echec.textContent += ' ' + L('contact', { c: opts.contact });
        echec.hidden = false;
        if (global.console) console.error('Envoi du formulaire :', e);
      });
    }
    function merci(reponses, apercu) {
      zone.innerHTML = '';
      var carte = el('div', { class: 'card merci', role: 'status', tabindex: '-1' });
      carte.appendChild(el('h2', { text: L('merci') }));
      if (apercu) carte.appendChild(el('p', { class: 'note warn', text: L('apercu') }));
      if (t(contenu.merci, lang).trim()) carte.appendChild(el('p', { html: mini(t(contenu.merci, lang)) }));
      var dl = el('dl', { class: 'recap' });
      qs.forEach(function (q) {
        if (!TYPES[q.type].reponse || !(q.id in reponses)) return;
        dl.appendChild(el('dt', { text: t(q.label, lang) }));
        dl.appendChild(el('dd', { text: lisible(q, reponses[q.id], lang) || '—' }));
      });
      carte.appendChild(el('h3', { text: L('vosReponses'), style: 'margin:18px 0 0;font-size:17px' }));
      carte.appendChild(dl);
      /* la réponse est partie : on vide l'état (un changement de langue repart d'un formulaire vierge) */
      Object.keys(rep).forEach(function (k) { delete rep[k]; });
      carte.appendChild(el('div', { class: 'envoi', style: 'margin-top:18px' }, [
        el('button', { class: 'btn btn-g', type: 'button', text: L('imprimer'), onclick: function () { global.print(); } }),
        el('button', { class: 'btn btn-g', type: 'button', text: L('autreReponse'), onclick: function () {
          Object.keys(rep).forEach(function (k) { delete rep[k]; });
          rendreFormulaire(zone, contenu, Object.assign({}, opts, { etat: rep, reprise: false }));
          global.scrollTo(0, 0);
        } })
      ]));
      zone.appendChild(carte);
      carte.scrollIntoView({ block: 'start' });
      carte.focus({ preventScroll: true });
      if (opts.apresEnvoi) opts.apresEnvoi(reponses);
    }
    return { etat: rep };
  }

  /* ---------------------------------------------------------
     9. Page publique : F.page({ outil, modele })
     --------------------------------------------------------- */
  function langueInitiale() {
    var m = location.search.match(/[?&]lang=(fr|en)\b/);
    if (m) return m[1];
    var n = (navigator.languages && navigator.languages[0]) || navigator.language || 'fr';
    return /^en/i.test(n) ? 'en' : 'fr';
  }
  function entete(fiche, lang, titre, info) {
    var hero = el('header', { class: 'card hero' });
    var img = global.Fiche && fiche ? Fiche.image(fiche, 'visuel') : '';
    if (img) hero.appendChild(el('img', { class: 'hero-img', src: img, alt: '' }));
    var txt = el('div', { class: 'hero-txt' });
    if (fiche) txt.appendChild(el('p', { class: 'hero-evt', text: t(fiche.nom, lang) }));
    txt.appendChild(el('h1', { text: titre }));
    if (fiche) {
      var lieu = fiche.lieu ? [fiche.lieu.nom, fiche.lieu.adresse].filter(Boolean).join(', ') : '';
      txt.appendChild(el('p', { class: 'hero-meta', text: [fiche.datesTexte ? fiche.datesTexte[lang] : '', lieu].filter(Boolean).join(' · ') }));
    }
    if (info) txt.appendChild(el('p', { class: 'hero-limite', text: info }));
    hero.appendChild(txt);
    return hero;
  }
  function appliquerCharte(fiche) {
    if (!global.Fiche || !fiche || !fiche.charte) return;
    Fiche.couleurs(fiche, { '--c': 'principale', '--c-fonce': 'principaleFoncee', '--c2': 'accent' });
  }

  F.page = function (opts) {
    var outil = opts.outil, racine = document.getElementById('app');
    var lang = langueInitiale();
    var fiche = null, contenu = null, ouverture = null, connexion = null, etat = {}, statut = 'chargement', detail = '', dejaAffiche = false;
    var arrivee = Date.now(), enEnvoi = false, minuterie = null;
    document.documentElement.lang = lang;

    function barreLangue() {
      var b = el('div', { class: 'pub-top' });
      var g = el('div', { class: 'lang', role: 'group', 'aria-label': 'Langue / Language' });
      [['fr', 'FR', 'Français'], ['en', 'EN', 'English']].forEach(function (x) {
        g.appendChild(el('button', { type: 'button', text: x[1], title: x[2], lang: x[0], 'data-lang': x[0], disabled: enEnvoi, 'aria-pressed': String(lang === x[0]), onclick: function () {
          if (lang === x[0] || enEnvoi) return;
          lang = x[0]; document.documentElement.lang = lang;
          try { var u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u.toString()); } catch (e) { /* rien */ }
          afficher();
          var b2 = racine.querySelector('.lang button[data-lang="' + lang + '"]'); if (b2) b2.focus();
        } }));
      });
      b.appendChild(g);
      return b;
    }
    function contactDe() {
      return (contenu && contenu.contact) || '';
    }
    function afficher() {
      racine.innerHTML = '';
      var p = el('div', { class: 'pub' });
      p.appendChild(barreLangue());
      var titre = contenu ? t(contenu.titre, lang) : t(F.OUTILS[outil], lang);
      document.title = titre + (fiche ? ' — ' + t(fiche.nom, lang) : '');
      if (statut === 'chargement') { p.appendChild(el('p', { class: 'chargement', text: msg(lang, 'chargement') })); racine.appendChild(p); return; }
      var info = '';
      if (statut === 'ouvert' && ouverture && ouverture.fin) info = msg(lang, 'jusquau', { d: dateHeureTexte(ouverture.fin, lang) });
      if (fiche && fiche.formulairesTest) p.appendChild(el('div', { class: 'note warn', role: 'note', style: 'margin-bottom:14px;font-weight:600', text: msg(lang, 'test') }));
      p.appendChild(entete(fiche, lang, titre, info));
      if (statut === 'ouvert') {
        var premier = !dejaAffiche; dejaAffiche = true;
        var zone = el('main');
        p.appendChild(zone);
        rendreFormulaire(zone, contenu, {
          lang: lang, etat: etat, reprise: premier, contact: contactDe(), debut: arrivee,
          pendantEnvoi: function (oui) {
            enEnvoi = oui;
            Array.prototype.forEach.call(racine.querySelectorAll('.lang button'), function (b) { b.disabled = oui; });
          },
          cleBrouillon: fiche ? 'form-' + fiche.id + '-' + outil : null,
          envoyer: function (reponses, lg) {
            var d = { r: reponses, lang: lg, cree: connexion.fb.firestore.FieldValue.serverTimestamp() };
            if (typeof contenu.version === 'number') d.v = contenu.version;
            return connexion.db.collection(chemin(fiche.id, outil) + '/reponses').add(d);
          }
        });
      } else {
        var boite = el('div', { class: 'card etat', role: 'status' });
        var titres = { ferme: msg(lang, 'ferme'), bientot: msg(lang, 'bientot', { d: dateHeureTexte(detail, lang) }), termine: msg(lang, 'termine', { d: dateHeureTexte(detail, lang) }), indispo: msg(lang, 'indispo'), erreur: msg(lang, 'chargementEchec'), introuvable: msg(lang, 'introuvable') };
        boite.appendChild(el('h2', { text: titres[statut] || titres.indispo }));
        if (statut === 'ferme' && contenu && t(contenu.ferme, lang).trim()) boite.appendChild(el('p', { html: mini(t(contenu.ferme, lang)) }));
        var c = contactDe();
        if (c) boite.appendChild(el('p', { html: mini(msg(lang, 'contact', { c: c })) }));
        p.appendChild(boite);
      }
      p.appendChild(el('p', { class: 'pub-foot', text: (fiche && fiche.lieu && fiche.lieu.centre ? t(fiche.lieu.centre, lang) : 'Centre de Méditation Kadampa France') }));
      racine.appendChild(p);
    }

    afficher();
    if (!global.Fiche) { statut = 'erreur'; afficher(); return; }
    Fiche.charger().then(function (f) {
      fiche = f; appliquerCharte(f);
      try { connexion = connecter(f, 'formulaires-public'); } catch (e) { statut = 'erreur'; afficher(); throw e; }
      if (!connexion) { statut = 'indispo'; afficher(); return; }
      return connexion.db.doc(chemin(f.id, outil)).get().then(function (snap) {
        var d = snap.exists ? snap.data() : null;
        if (!d || !d.publie) { statut = 'indispo'; afficher(); return; }
        contenu = d.publie; ouverture = d.ouverture || {};
        var e = etatOuverture(ouverture);
        statut = e.etat; detail = e.date || '';
        afficher();
        /* page ouverte avant l'heure d'ouverture : le formulaire apparaît tout seul le moment venu */
        if (e.etat === 'bientot') {
          var attente = parisVersDate(e.date).getTime() - Date.now() + 1500;
          if (attente > 0 && attente < 2147483000) minuterie = setTimeout(function () {
            var e2 = etatOuverture(ouverture); statut = e2.etat; detail = e2.date || ''; arrivee = Date.now() - 60000; afficher();
          }, attente);
        }
      });
    }).catch(function (e) {
      if (global.console) console.error(e);
      if (statut === 'chargement') { statut = /Introuvable/.test(e && e.message) ? 'introuvable' : 'erreur'; afficher(); }
    });
  };

  /* ---------------------------------------------------------
     Exports
     --------------------------------------------------------- */
  F.util = { esc: esc, t: t, el: el, clone: clone, uid: uid, mini: mini, stockage: stockage, telecharger: telecharger };
  F.dates = { dateValide: dateValide, heureValide: heureValide, dateHeureValide: dateHeureValide, jourTexte: jourTexte, heureTexte: heureTexte, dateHeureTexte: dateHeureTexte, decalerJour: decalerJour, parisVersDate: parisVersDate, dateVersParis: dateVersParis, horodatage: horodatage, etatOuverture: etatOuverture };
  F.TYPES = TYPES; F.OPERATEURS = OPERATEURS; F.AUTRE_ID = AUTRE_ID; F.AUTRE = AUTRE; F.M = M; F.msg = msg;
  F.options = options; F.estVisible = estVisible; F.valider = valider; F.reponsesVisibles = reponsesVisibles; F.lisible = lisible;
  F.verifierContenu = verifierContenu; F.colonnes = colonnes; F.csv = csv; F.celluleCSV = celluleCSV; F.valeurVide = valeurVide; F.trouverOption = trouverOption;
  F.configFirebase = configFirebase; F.connecter = connecter; F.chemin = chemin; F.codeErreur = codeErreur;
  F.rendreFormulaire = rendreFormulaire; F.entete = entete; F.appliquerCharte = appliquerCharte;

  global.Formulaires = F;
})(typeof window !== 'undefined' ? window : globalThis);
