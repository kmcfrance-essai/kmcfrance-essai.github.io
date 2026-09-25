/* =========================================================
   fiche.js — lecture de la fiche événement (CMK France)
   Partagé par le hub, l'app mobile, l'outil liens, les badges
   et les formulaires (navettes, bénévolat).

   Où sont les fiches :  /evenements/<id>/fiche.json
   Liste + événement courant :  /evenements/index.json
   Choix de l'événement :  ?evt=<id> dans l'adresse, sinon « courant ».

   Utilisation :
     <script src="/commun/fiche.js"></script>
     Fiche.charger().then(function (f) { ... });
   ========================================================= */
(function (global) {
  'use strict';

  var FALLBACK_ORIGIN = 'https://kmcfrance.github.io';
  var BASE = location.protocol === 'file:' ? FALLBACK_ORIGIN : location.origin;

  var JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var JOURS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var ABR_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  var ABR_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var CLE = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  var MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Introuvable : ' + url + ' (' + r.status + ')');
      return r.json();
    });
  }

  /* 'AAAA-MM-JJ' ou 'AAAA-MM-JJTHH:MM' → Date locale (heure de Paris pour les utilisateurs en France) */
  function date(s) {
    var p = String(s).split(/[-T:]/).map(Number);
    return new Date(p[0], p[1] - 1, p[2], p[3] || 0, p[4] || 0);
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* '20:15' → '20h15' ; '09:00' → '09h' */
  function hh(s) {
    if (!s) return '';
    var p = s.split(':');
    return p[0] + 'h' + (p[1] && p[1] !== '00' ? p[1] : '');
  }
  function minutes(s) { var p = s.split(':').map(Number); return p[0] * 60 + (p[1] || 0); }

  /* Texte bilingue : { fr, en } ou chaîne simple */
  function t(o, lang) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return o[lang || 'fr'] || o.fr || o.en || '';
  }

  /* Type d'événement : « celebration » (Célébration du Dharma), « festival » ou « autre ».
     Champ typeEvenement de la fiche ; s'il est absent, déduit du nom français. */
  var TYPES = ['celebration', 'festival', 'autre'];
  function typeDuNom(nom) {
    var n = String(nom || '');
    if (/festival/i.test(n)) return 'festival';
    if (/c[ée]l[ée]bration/i.test(n)) return 'celebration';
    return 'autre';
  }
  function typeEvenement(f) {
    var v = f && f.typeEvenement;
    return TYPES.indexOf(v) > -1 ? v : typeDuNom(t(f && f.nom, 'fr'));
  }

  /* Enrichit la fiche avec des valeurs calculées (jamais stockées dans le fichier) */
  function preparer(f, id) {
    f.id = f.id || id;
    f.dossier = BASE + '/evenements/' + f.id + '/';
    f.type = typeEvenement(f);                              /* 'celebration' | 'festival' | 'autre' */
    f.typeDeduit = TYPES.indexOf(f.typeEvenement) < 0;      /* true = déduit du nom (champ absent) */

    /* Jours de l'événement, du début à la fin */
    var jours = [];
    for (var d = date(f.debut); d <= date(f.fin); d.setDate(d.getDate() + 1)) {
      var w = d.getDay(), n = d.getDate();
      jours.push({
        cle: CLE[w] + '-' + n,              /* ex. 'ven-27' (format historique de l'app) */
        date: iso(d),
        court: { fr: ABR_FR[w] + ' ' + n, en: ABR_EN[w] + ' ' + n },
        long: { fr: JOURS_FR[w] + ' ' + n, en: JOURS_EN[w] + ' ' + n }
      });
    }
    f.jours = jours;
    var parDate = {};
    jours.forEach(function (j) { parDate[j.date] = j; });

    /* Programme : ajoute la clé de jour, l'horaire affiché et la durée */
    (f.programme || []).forEach(function (p) {
      p.cleJour = parDate[p.jour] ? parDate[p.jour].cle : p.jour;
      p.heure = hh(p.debut) + (p.fin ? ' – ' + hh(p.fin) : '');
      p.duree = p.fin ? minutes(p.fin) - minutes(p.debut) : null;
    });

    /* Séances de streaming = éléments du programme marqués « seance » */
    f.seances = (f.programme || []).filter(function (p) { return p.seance; }).map(function (p, i) {
      return { numId: i + 1, nom: p.seance, date: date(p.jour + 'T' + p.debut), duree: p.duree || 60 };
    });

    /* Dates au format lisible */
    var a = date(f.debut), b = date(f.fin);
    var memeMois = a.getMonth() === b.getMonth();
    f.datesTexte = {
      fr: a.getDate() + (memeMois ? '' : ' ' + MOIS_FR[a.getMonth()]) + ' – ' + b.getDate() + ' ' + MOIS_FR[b.getMonth()] + ' ' + b.getFullYear(),
      en: a.getDate() + (memeMois ? '' : ' ' + MOIS_EN[a.getMonth()]) + ' – ' + b.getDate() + ' ' + MOIS_EN[b.getMonth()] + ' ' + b.getFullYear()
    };

    /* Adresses des outils : celles de la fiche, sinon les outils génériques */
    var q = '?evt=' + encodeURIComponent(f.id);
    f.outils = {
      appPublic: abs((f.app && f.app.url) || '/app/' + q),
      appAdmin: abs((f.app && f.app.admin) || '/app/admin.html' + q),
      liensPublic: abs((f.streaming && f.streaming.url) || '/liens/' + q),
      liensAdmin: abs((f.streaming && f.streaming.admin) || '/liens/admin.html' + q),
      badges: abs((f.badges && f.badges.url) || '/badges/' + q),
      navettesPublic: abs('/navettes/' + q),
      navettesAdmin: abs('/navettes/admin.html' + q),
      benevolatPublic: abs('/benevolat/' + q),
      benevolatAdmin: abs('/benevolat/admin.html' + q),
      lettres: abs('/lettres/' + q)
    };
    /* Formulaires navettes et bénévolat : actifs dès que la fiche contient leur projet Firebase */
    var ff = f.formulaires && f.formulaires.firebase;
    f.formulairesActifs = !!(ff && ff.apiKey && ff.projectId && ff.appId);
    /* « en test » : utilisables par l'équipe, mais pas encore diffusés (pas de lien sur le hub, bandeau sur la page) */
    f.formulairesTest = !!(f.formulaires && f.formulaires.test);
    return f;
  }

  function abs(u) { return u.charAt(0) === '/' ? BASE + u : u; }

  var Fiche = {
    BASE: BASE,
    t: t,
    date: date,
    TYPES: TYPES,
    /* Type d'une fiche (préparée ou brute) : Fiche.type(f) ; d'un nom seul : Fiche.typeDuNom('Festival français 2027') */
    type: typeEvenement,
    typeDuNom: typeDuNom,

    /* id demandé dans l'adresse (?evt=), ou null */
    idDemande: function () {
      var m = location.search.match(/[?&]evt=([^&#]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    },

    /* Liste des événements + id courant */
    index: function () { return getJSON(BASE + '/evenements/index.json'); },

    /* Charge la fiche de l'événement demandé (ou courant) */
    charger: function (id) {
      id = id || Fiche.idDemande();
      var p = id ? Promise.resolve(id) : Fiche.index().then(function (ix) { return ix.courant; });
      return p.then(function (evt) {
        return getJSON(BASE + '/evenements/' + evt + '/fiche.json').then(function (f) { return preparer(f, evt); });
      });
    },

    /* Adresse complète d'une image de la fiche : Fiche.image(f, 'visuel') */
    image: function (f, nom) {
      var v = f.images && f.images[nom];
      if (!v) return '';
      return /^(https?:|data:|\/)/.test(v) ? abs(v) : f.dossier + v;
    },

    /* Nom de clé de stockage propre à l'événement (évite les mélanges entre événements) */
    cle: function (f, nom) { return 'evt-' + f.id + '-' + nom; },

    /* Applique les couleurs de la charte à des variables CSS : Fiche.couleurs(f, {'--pink':'principale', ...}) */
    couleurs: function (f, correspondances, cible) {
      var c = f.charte || {}, el = cible || document.documentElement;
      Object.keys(correspondances).forEach(function (v) {
        var val = c[correspondances[v]];
        if (val) el.style.setProperty(v, val);
      });
    }
  };

  global.Fiche = Fiche;
})(window);
