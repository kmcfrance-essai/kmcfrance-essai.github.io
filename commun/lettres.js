/* =========================================================
   lettres.js — moteur des lettres KBS (CMK France)
   Utilisé par /lettres/ (éditeur) ; testable sans navigateur.

   Une lettre = un texte balisé (voir BALISAGE plus bas), où :
     [ref], [DearOne]…  sont les variables KBS, laissées telles quelles ;
     {evenement}, {dates}… sont les valeurs de l'événement (fiche + onglet Valeurs) ;
     [texte](adresse)     est un lien caché derrière un texte.
   Le moteur en fait un .docx « Style C » (mise en page présentiel ou streaming,
   identique aux lettres CD2026 validées), sans image, tableau, en-tête ni pied de page.
   Dépend de : lettres-base.js (styles des .docx d'origine).
   ========================================================= */
(function (g) {
  'use strict';
  var L = {};
  L.VERSION = 'Lettres v1.1 · 25/09/2026';

  /* ---------- Variables KBS autorisées (34) ---------- */
  L.VARIABLES_KBS = ['DearOne', 'fullName', 'fullAndLayName', 'email', 'phone', 'address', 'address_france', 'ordainedAgeGender', 'passport',
    'ref', 'yourCart', 'yourAccount', 'yourAccountOrCart', 'yourBooking', 'options', 'bookingUrl',
    'invoiced', 'deposit', 'balance', 'minDeposit',
    'event', 'eventName', 'eventId', 'program',
    'centre', 'center', 'siteAddress', 'parkingPermit', 'parkingPermitSite', 'children',
    'now', 'halfHourBefore', 'oneMonthAfterEvent', 'signature'];
  var LIENS_KBS = ['yourCart', 'yourAccount', 'yourAccountOrCart', 'yourBooking', 'bookingUrl'];

  /* ---------- Valeurs de l'événement ---------- */
  L.VALEURS = [
    { cle: 'evenement', nom: 'Nom de l\'événement', groupe: 'Événement' },
    { cle: 'dates', nom: 'Dates (en-tête)', groupe: 'Événement', ex: '27–30 novembre' },
    { cle: 'datesDu', nom: 'Dates dans une phrase', groupe: 'Événement', ex: 'du 27 au 30 novembre' },
    { cle: 'sousTitre', nom: 'Sous-titre (thème)', groupe: 'Événement' },
    { cle: 'jourArrivee', nom: 'Jour d\'arrivée', groupe: 'Événement', ex: 'vendredi 27 novembre' },
    { cle: 'jourDepart', nom: 'Jour de départ', groupe: 'Événement', ex: 'lundi 30 novembre' },
    { cle: 'dateLimitePaiement', nom: 'Date limite de paiement du solde', groupe: 'Dates limites', ex: '13 novembre 2026' },
    { cle: 'finDiffere', nom: 'Fin du différé (streaming)', groupe: 'Dates limites', ex: 'mardi 8 décembre à 12h30' },
    { cle: 'navettesAller', nom: 'Navettes : horaires aller', groupe: 'Navettes', ex: 'entre 12h30 et 19h15' },
    { cle: 'navettesRetour', nom: 'Navettes : horaires retour', groupe: 'Navettes', ex: 'entre 13h et 18h30' },
    { cle: 'navettesPrix', nom: 'Navettes : prix par trajet', groupe: 'Navettes', ex: '5 €' },
    { cle: 'navettesDateLimite', nom: 'Navettes : date limite de réservation', groupe: 'Navettes', ex: '24 novembre' },
    { cle: 'benevolatJour', nom: 'Bénévolat : jour d\'arrivée au plus tard', groupe: 'Bénévolat', ex: 'mercredi 25 novembre' },
    { cle: 'lienPage', nom: 'Lien : page de l\'événement', groupe: 'Liens', lien: true },
    { cle: 'lienCommentVenir', nom: 'Lien : comment venir', groupe: 'Liens', lien: true },
    { cle: 'lienTC', nom: 'Lien : termes et conditions', groupe: 'Liens', lien: true },
    { cle: 'lienNavettes', nom: 'Lien : formulaire navettes', groupe: 'Liens', lien: true },
    { cle: 'lienBenevolat', nom: 'Lien : formulaire bénévolat', groupe: 'Liens', lien: true },
    { cle: 'contact', nom: 'Adresse de contact', groupe: 'Signature' },
    { cle: 'centre', nom: 'Nom du centre', groupe: 'Signature' },
    { cle: 'lieu', nom: 'Adresse du lieu (pied de page)', groupe: 'Signature' },
    { cle: 'formule', nom: 'Formule de politesse', groupe: 'Signature' },
    { cle: 'equipe', nom: 'Signature (équipe)', groupe: 'Signature' }
  ];
  var CLES = {}; L.VALEURS.forEach(function (v) { CLES[v.cle] = v; });

  var JOURS = { fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
  var MOIS = { fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
  function dv(s) { return /^\d{4}-\d{2}-\d{2}/.test(s || ''); }
  function parts(s) { var p = s.slice(0, 10).split('-').map(Number); return { a: p[0], m: p[1] - 1, j: p[2], js: new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() }; }
  function jour(s, lang, avecAnnee, sansJour) {
    var p = parts(s);
    var t = lang === 'en' ? (sansJour ? '' : JOURS.en[p.js] + ' ') + p.j + ' ' + MOIS.en[p.m] : (sansJour ? '' : JOURS.fr[p.js] + ' ') + (p.j === 1 ? '1er' : p.j) + ' ' + MOIS.fr[p.m];
    return t + (avecAnnee ? ' ' + p.a : '');
  }
  function heure(h, lang) {
    var p = h.split(':').map(Number);
    if (lang === 'en') { var s = p[0] >= 12 ? 'pm' : 'am', h12 = p[0] % 12 || 12; return h12 + (p[1] ? ':' + String(p[1]).padStart(2, '0') : '') + ' ' + s; }
    return p[0] + 'h' + (p[1] ? String(p[1]).padStart(2, '0') : '');
  }
  function bil(fr, en) { return { fr: fr || '', en: en || '' }; }
  function t(o, lang) { if (o == null) return ''; if (typeof o === 'string') return o; return o[lang] != null && o[lang] !== '' ? o[lang] : (o.fr || ''); }
  function lienFiche(fiche, re) {
    var l = (fiche.liens || []).filter(function (x) { return re.test(t(x.label, 'fr')); })[0];
    return l ? l.url : '';
  }
  /* Date clé de la fiche : d'abord celle qui correspond à « prefere » (ex. « limite… navettes »), sinon à « re » */
  function dateCle(fiche, re, prefere) {
    var ds = (fiche.datesCles || []).filter(function (x) { return dv(x.date); });
    var d = (prefere && ds.filter(function (x) { return prefere.test(t(x.texte, 'fr')); })[0]) || ds.filter(function (x) { return re.test(t(x.texte, 'fr')); })[0];
    return d ? d.date : '';
  }
  /* Adresse publique des outils (jamais l'adresse d'un test local ou d'une copie) */
  L.ORIGINE_PUBLIQUE = 'https://kmcfrance.github.io';
  function publique(u) { return /^https:\/\//.test(u) && !/^https:\/\/(localhost|127\.)/.test(u) ? u : String(u).replace(/^https?:\/\/[^/]+/, L.ORIGINE_PUBLIQUE); }

  /* Valeurs calculées depuis la fiche (chaque valeur : { fr, en }) */
  L.valeursFiche = function (fiche) {
    var v = {};
    v.evenement = bil(t(fiche.nom, 'fr'), t(fiche.nom, 'en'));
    v.sousTitre = bil(t(fiche.sousTitre, 'fr'), t(fiche.sousTitre, 'en'));
    if (dv(fiche.debut) && dv(fiche.fin)) {
      var a = parts(fiche.debut), b = parts(fiche.fin), meme = a.m === b.m && a.a === b.a;
      v.dates = bil(meme ? (a.j === 1 ? '1er' : a.j) + '–' + b.j + ' ' + MOIS.fr[b.m] : jour(fiche.debut, 'fr', false, true) + ' – ' + jour(fiche.fin, 'fr', false, true),
        meme ? a.j + '–' + b.j + ' ' + MOIS.en[b.m] : jour(fiche.debut, 'en', false, true) + ' – ' + jour(fiche.fin, 'en', false, true));
      v.datesDu = bil('du ' + (meme ? (a.j === 1 ? '1er' : a.j) : jour(fiche.debut, 'fr', false, true)) + ' au ' + jour(fiche.fin, 'fr', false, true),
        'from ' + (meme ? a.j : jour(fiche.debut, 'en', false, true)) + ' to ' + jour(fiche.fin, 'en', false, true));
      v.jourArrivee = bil(jour(fiche.debut, 'fr'), jour(fiche.debut, 'en'));
      v.jourDepart = bil(jour(fiche.fin, 'fr'), jour(fiche.fin, 'en'));
    }
    var dp = dateCle(fiche, /solde|paiement/i, /limite.*(solde|paiement)|(solde|paiement).*limite/i);
    if (dp) v.dateLimitePaiement = bil(jour(dp, 'fr', true, true), jour(dp, 'en', true, true));
    var dn = dateCle(fiche, /navette/i, /limite.*navette|navette.*limite/i);
    if (dn) v.navettesDateLimite = bil(jour(dn, 'fr', false, true), jour(dn, 'en', false, true));
    var db = dateCle(fiche, /b[ée]n[ée]vol/i, /arriv.*b[ée]n[ée]vol|b[ée]n[ée]vol.*arriv/i);
    if (db) v.benevolatJour = bil(jour(db, 'fr'), jour(db, 'en'));
    var fd = fiche.streaming && fiche.streaming.finDiffere;
    if (dv(fd) && /T\d{2}:\d{2}/.test(fd)) v.finDiffere = bil(jour(fd, 'fr') + ' à ' + heure(fd.slice(11, 16), 'fr'), jour(fd, 'en') + ' at ' + heure(fd.slice(11, 16), 'en'));
    if (fiche.pageWeb) v.lienPage = bil(fiche.pageWeb, fiche.pageWeb);
    var cv = lienFiche(fiche, /comment venir/i); if (cv) v.lienCommentVenir = bil(cv, cv);
    var tc = lienFiche(fiche, /termes|conditions/i); if (tc) v.lienTC = bil(tc, tc);
    /* formulaires : ceux du hub s'ils sont diffusés, sinon les liens de la fiche (ex. Google Forms) */
    var o = fiche.outils || {};
    var nouveaux = fiche.formulairesActifs && !fiche.formulairesTest;
    var ln = nouveaux && o.navettesPublic ? publique(o.navettesPublic) : lienFiche(fiche, /navette/i);
    if (ln) v.lienNavettes = bil(ln, nouveaux ? ln + (ln.indexOf('?') > -1 ? '&' : '?') + 'lang=en' : ln);
    var lb = nouveaux && o.benevolatPublic ? publique(o.benevolatPublic) : lienFiche(fiche, /b[ée]n[ée]volat/i);
    if (lb) v.lienBenevolat = bil(lb, nouveaux ? lb + (lb.indexOf('?') > -1 ? '&' : '?') + 'lang=en' : lb);
    var c = (fiche.contacts || []).filter(function (x) { return x.email && /inscription/i.test(x.role || ''); })[0];
    var mail = c ? c.email : (fiche.streaming && fiche.streaming.contact) || '';
    if (mail) v.contact = bil(mail, mail);
    var centre = fiche.lieu && fiche.lieu.centre;
    v.centre = centre ? bil(t(centre, 'fr'), t(centre, 'en')) : bil('Centre de Méditation Kadampa France', 'Kadampa Meditation Centre France');
    if (fiche.lieu) { var li = [fiche.lieu.nom, fiche.lieu.adresse].filter(Boolean).join(', '); v.lieu = bil(li, li); }
    v.formule = bil('Chaleureusement,', 'With best wishes,');
    v.equipe = bil('L\'équipe des inscriptions', 'The Registration Team');
    return v;
  };
  /* Valeurs utilisées : celles de l'onglet Valeurs (surcharges) l'emportent sur celles de la fiche */
  L.valeurs = function (fiche, surcharges) {
    var v = L.valeursFiche(fiche || {}), s = surcharges || {};
    Object.keys(CLES).forEach(function (k) {
      var base = v[k] || bil('', ''), o = s[k] || {};
      v[k] = { fr: o.fr != null && o.fr !== '' ? o.fr : base.fr, en: o.en != null && o.en !== '' ? o.en : base.en, source: { fr: o.fr ? 'lettres' : base.fr ? 'fiche' : '', en: o.en ? 'lettres' : base.en ? 'fiche' : '' } };
    });
    return v;
  };
  L.resoudre = function (texte, valeurs, lang) {
    return String(texte || '').replace(/\{([A-Za-z]+)\}/g, function (m, k) {
      if (!CLES[k]) return m;
      var x = valeurs[k] && valeurs[k][lang];
      return x ? x : m;
    });
  };

  /* ---------- Balisage ----------
     @entete                    nom du centre, de l'événement, dates, puis un trait
     # Titre                    titre de la lettre
     @sous-titre Texte          sous-titre (thème)
     @salutation [DearOne],     formule d'appel
     @info Texte                ligne serrée (ex. référence)
     ## Titre de partie         partie numérotée automatiquement (1, 2, 3…)
     - Texte                    ligne à puce
     !! Texte                   ligne mise en avant (orange, gras)
     ---                        trait de séparation
     @signature                 formule, équipe, centre, adresse de contact
     @signature-kbs             la variable [signature] de KBS
     @pied Texte                trait puis ligne de bas de page
     Autre ligne                paragraphe. **gras**, *italique*, [texte](adresse)
  */
  L.COMMANDES = ['entete', 'sous-titre', 'salutation', 'info', 'signature', 'signature-kbs', 'pied'];
  L.BALISAGE = [
    ['@entete', 'En-tête : centre, événement, dates, puis un trait'],
    ['# Titre', 'Titre de la lettre'],
    ['@sous-titre Texte', 'Sous-titre (ex. {sousTitre})'],
    ['@salutation [DearOne],', 'Formule d\'appel'],
    ['@info Texte', 'Ligne serrée (ex. « Réf. d\'inscription : [ref] »)'],
    ['## Titre de partie', 'Partie numérotée automatiquement'],
    ['- Texte', 'Ligne à puce'],
    ['!! Texte', 'Ligne mise en avant (orange, gras)'],
    ['---', 'Trait de séparation'],
    ['@signature', 'Formule, équipe, centre et adresse de contact'],
    ['@signature-kbs', 'Signature automatique de KBS ([signature])'],
    ['@pied Texte', 'Trait puis ligne de bas de page'],
    ['**gras**  *italique*', 'Mise en forme dans un paragraphe'],
    ['[texte](adresse)', 'Lien caché derrière un texte (adresse : https://…, {lienNavettes}, [yourCart]…)'],
    ['{evenement}', 'Valeur de l\'événement (liste dans l\'onglet Valeurs)'],
    ['[ref]', 'Variable KBS, laissée telle quelle']
  ];
  L.analyser = function (texte) {
    var blocs = [];
    String(texte || '').split(/\r?\n/).forEach(function (ligne, i) {
      var l = ligne.trim(), m, n = i + 1, cmd = (/^@([A-Za-z-]+)(?:\s+(.*))?$/.exec(l) || []);
      var nomCmd = (cmd[1] || '').toLowerCase(), arg = (cmd[2] || '').trim();
      if (!l) return;
      if (nomCmd === 'entete' && !arg) blocs.push({ t: 'entete', n: n });
      else if (nomCmd === 'sous-titre' && arg) blocs.push({ t: 'sous', x: arg, n: n });
      else if (nomCmd === 'salutation' && arg) blocs.push({ t: 'salut', x: arg, n: n });
      else if (nomCmd === 'info' && arg) blocs.push({ t: 'info', x: arg, n: n });
      else if (nomCmd === 'signature' && !arg) blocs.push({ t: 'signature', n: n });
      else if (nomCmd === 'signature-kbs' && !arg) blocs.push({ t: 'sigkbs', n: n });
      else if (nomCmd === 'pied' && arg) blocs.push({ t: 'pied', x: arg, n: n });
      else if (cmd[1] && L.COMMANDES.indexOf(nomCmd) > -1) blocs.push({ t: 'inconnu', x: l, n: n, msg: 'Commande « @' + nomCmd + ' » mal écrite (texte manquant ou en trop).' });
      else if (cmd[1] && /^[a-z-]+$/.test(cmd[1]) && !/[.@]/.test(l.slice(1))) blocs.push({ t: 'inconnu', x: l, n: n });
      else if ((m = /^##\s+(.+)$/.exec(l))) blocs.push({ t: 'sec', x: m[1], n: n });
      else if ((m = /^#\s+(.+)$/.exec(l))) blocs.push({ t: 'titre', x: m[1], n: n });
      else if (/^-{3,}$/.test(l)) blocs.push({ t: 'sep', n: n });
      else if ((m = /^-\s+(.+)$/.exec(l))) blocs.push({ t: 'puce', x: m[1], n: n });
      else if ((m = /^!!\s+(.+)$/.exec(l))) blocs.push({ t: 'alerte', x: m[1], n: n });
      else blocs.push({ t: 'p', x: l, n: n, suspect: /^(#|-(?!-)|!!)/.test(l) });
    });
    return blocs;
  };
  /* Texte d'un paragraphe → morceaux { x, b, i, lien, mail } */
  var RE_LIEN = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
  var RE_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  /* ** et * ouvrent / ferment le gras et l'italique, y compris autour d'un lien */
  L.enLigne = function (s) {
    var out = [], i = 0, m, etat = { b: false, i: false };
    RE_LIEN.lastIndex = 0;
    while ((m = RE_LIEN.exec(s))) {
      if (m.index > i) mise(s.slice(i, m.index), out, etat);
      out.push({ x: m[1].replace(/\*\*|\*/g, ''), lien: m[2] });
      i = RE_LIEN.lastIndex;
    }
    if (i < s.length) mise(s.slice(i), out, etat);
    return out;
  };
  function mise(s, out, etat) {
    s.split(/(\*\*|\*)/).forEach(function (morceau) {
      if (morceau === '**') { etat.b = !etat.b; return; }
      if (morceau === '*') { etat.i = !etat.i; return; }
      if (morceau) mails(morceau, { b: etat.b, i: etat.i }, out);
    });
  }
  function mails(s, st, out) {
    var i = 0, m; RE_MAIL.lastIndex = 0;
    while ((m = RE_MAIL.exec(s))) {
      if (m.index > i) out.push(Object.assign({ x: s.slice(i, m.index) }, st));
      out.push(Object.assign({ x: m[0], mail: true }, st));
      /* (le style est une copie : les morceaux restent indépendants) */
      i = RE_MAIL.lastIndex;
    }
    if (i < s.length) out.push(Object.assign({ x: s.slice(i) }, st));
  }

  /* ---------- Mises en page (reprises des lettres CD2026) ---------- */
  var C = { teal: '22594E', orange: 'EB570F', texte: '4A4A4A', clair: '999999' };
  var R = {
    corps: { f: 'Calibri', sz: 21, c: C.texte },
    lien: { f: 'Calibri', sz: 22, c: C.orange, u: true },
    centre: { f: 'Calibri', sz: 25, c: C.teal, b: true, sp: 60 },
    evt: { f: 'Georgia', sz: 30, c: C.orange, i: true },
    dates: { f: 'Calibri', sz: 28, c: C.clair },
    titre: { f: 'Georgia', sz: 32, c: C.teal, b: true },
    sous: { f: 'Georgia', sz: 20, c: C.orange, i: true },
    num: { f: 'Georgia', sz: 28, c: C.orange, b: true },
    sec: { f: 'Georgia', sz: 22, c: C.teal, b: true },
    puce: { f: 'Calibri', sz: 21, c: C.orange, b: true },
    alerte: { f: 'Calibri', sz: 22, c: C.orange, b: true },
    petitOrange: { f: 'Calibri', sz: 18, c: C.orange },
    pied: { f: 'Calibri', sz: 18, c: C.clair }
  };
  L.GABARITS = {
    presentiel: {
      nom: 'Présentiel',
      page: '<w:pgSz w:w="12240" w:h="15840" w:orient="portrait"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>',
      entete: [{ after: 160 }, { after: 40 }, { after: 80 }],
      trait: { before: 100, after: 100, bord: { color: '999999', sz: 1 } },
      traitEntete: { before: 100, after: 100, bord: { color: '999999', sz: 1 } },
      traitPied: { before: 100, after: 100, bord: { color: '999999', sz: 1 } },
      titre: { before: 200, after: 160 }, sous: { after: 200 },
      salut: { after: 200, b: true }, p: { after: 160 }, info: { after: 40 },
      sec: { before: 240, after: 120, apresNum: '. ' }, puce: { after: 160 }, alerte: { before: 60, after: 100 },
      sigkbs: { before: 200, after: 0 }, pied: { after: 160 },
      mail: 'texte'
    },
    streaming: {
      nom: 'Streaming',
      page: '<w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/><w:pgMar w:top="850" w:right="1304" w:bottom="850" w:left="1304" w:header="708" w:footer="708" w:gutter="0"/>',
      entete: [{ after: 60 }, { after: 60 }, { after: 60 }],
      trait: { before: 200, after: 200, bord: { color: 'CCCCCC', sz: 6, space: 1 } },
      traitEntete: { before: 120, after: 240, bord: { color: 'CCCCCC', sz: 6, space: 1 } },
      traitPied: { before: 200, after: 80, bord: { color: 'CCCCCC', sz: 6, space: 1 } },
      titre: { after: 60, jc: 'center' }, sous: { after: 280, jc: 'center' },
      salut: { after: 110, line: 276 }, p: { after: 110, line: 276 }, info: { after: 40 },
      sec: { before: 220, after: 80, apresNum: '  ' }, puce: { after: 110, line: 276 }, alerte: { before: 60, after: 100 },
      sigkbs: { before: 200, after: 0 }, pied: { after: 60 },
      pApresInfo: { after: 240 }, pAccroche: { before: 120, after: 110, line: 276 },
      mail: 'lien'
    },
    /* version serrée (tient sur une page) : lettre de confirmation streaming */
    streamingCompact: {
      nom: 'Streaming (serré)', styles: 'streaming',
      page: '<w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/><w:pgMar w:top="620" w:right="1134" w:bottom="560" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>',
      entete: [{ after: 50 }, { after: 50 }, { after: 50 }],
      trait: { before: 160, after: 160, bord: { color: 'CCCCCC', sz: 6, space: 1 } },
      traitEntete: { before: 60, after: 140, bord: { color: 'CCCCCC', sz: 6, space: 1 } },
      traitPied: { before: 140, after: 60, bord: { color: 'CCCCCC', sz: 6, space: 1 } },
      titre: { after: 50, jc: 'center' }, sous: { after: 160, jc: 'center' },
      salut: { after: 90, line: 259 }, p: { after: 90, line: 259 }, info: { after: 30 },
      sec: { before: 160, after: 60, apresNum: '  ' }, puce: { after: 90, line: 259 }, alerte: { before: 60, after: 100 },
      sigkbs: { before: 120, after: 0 }, pied: { after: 50 },
      pApresInfo: { after: 200 }, pAccroche: { before: 100, after: 90, line: 259 },
      mail: 'lien'
    }
  };
  /* Mise en page d'une lettre pour une version (présentiel / streaming) */
  L.gabarit = function (lettre, version) { return (lettre && lettre.mise && lettre.mise[version]) || version; };

  /* Blocs → paragraphes mis en forme : [{ sp, jc, bord, runs: [{ x, st, lien }] }] */
  L.paragraphes = function (blocs, gabarit, lang, valeurs) {
    var G = L.GABARITS[gabarit] || L.GABARITS.presentiel, P = [], num = 0, avant = null;
    var res = function (s) { return L.resoudre(s, valeurs, lang); };
    var runs = function (s, base) {
      return L.enLigne(res(s)).map(function (m) {
        if (m.lien) return { x: m.x, st: R.lien, lien: m.lien };
        if (m.mail && G.mail === 'lien' && !base.nomail) return { x: m.x, st: R.lien, lien: 'mailto:' + m.x };
        var st = Object.assign({}, base.st || R.corps);
        if (m.mail) st.c = C.orange;
        if (m.b || base.b) st.b = true;
        if (m.i) st.i = true;
        return { x: m.x, st: st };
      });
    };
    var para = function (sp, rs, extra) { P.push(Object.assign({ sp: sp, runs: rs }, extra || {})); };
    var val = function (k) { return (valeurs[k] && valeurs[k][lang]) || '{' + k + '}'; };
    blocs.forEach(function (b) {
      switch (b.t) {
        case 'entete':
          para(G.entete[0], [{ x: val('centre').toLocaleUpperCase('fr'), st: R.centre }], { jc: 'center' });
          para(G.entete[1], [{ x: val('evenement'), st: R.evt }], { jc: 'center' });
          para(G.entete[2], [{ x: val('dates'), st: R.dates }], { jc: 'center' });
          para(G.traitEntete, [], { bord: G.traitEntete.bord });
          break;
        case 'titre': para(G.titre, [{ x: res(b.x), st: R.titre }], { jc: G.titre.jc }); break;
        case 'sous': para(G.sous, [{ x: res(b.x), st: R.sous }], { jc: G.sous.jc }); break;
        case 'salut': para(G.salut, runs(b.x, { b: G.salut.b })); break;
        case 'info': para(G.info, runs(b.x, {})); break;
        case 'sec':
          num++;
          para({ before: G.sec.before, after: G.sec.after }, [{ x: num + G.sec.apresNum, st: R.num }, { x: res(b.x), st: R.sec }]);
          break;
        case 'puce': para(G.puce, [{ x: '•  ', st: R.puce }].concat(runs(b.x, {}))); break;
        case 'alerte': para(G.alerte, runs(b.x, { st: R.alerte, nomail: true })); break;
        case 'sep': para(G.trait, [], { bord: G.trait.bord }); break;
        case 'signature':
          para(G.trait, [], { bord: G.trait.bord });
          para({ after: 80 }, [{ x: val('formule'), st: Object.assign({}, R.corps, { i: true }) }]);
          para({ after: 160 }, [{ x: val('equipe'), st: Object.assign({}, R.corps, { b: true }) }]);
          para({ after: 40 }, [{ x: val('centre'), st: Object.assign({}, R.corps, { b: true }) }]);
          para({ after: 160 }, [{ x: val('contact'), st: R.petitOrange }]);
          break;
        case 'sigkbs': para(G.sigkbs, [{ x: '[signature]', st: Object.assign({}, R.corps, { b: true }) }]); break;
        case 'pied':
          para(G.traitPied, [], { bord: G.traitPied.bord });
          para(G.pied, [{ x: res(b.x), st: R.pied }], { jc: 'center' });
          break;
        case 'p': default:
          if (b.t === 'inconnu') break;
          var sp = G.p;
          if (avant === 'info' && G.pApresInfo) sp = G.pApresInfo;
          else if (G.pAccroche && /^\*\*[^*]+\*\*/.test(b.x) && avant !== 'salut' && avant !== 'sec') sp = G.pAccroche;
          para(sp, runs(b.x, {}));
      }
      avant = b.t;
    });
    return P;
  };

  /* ---------- Aperçu HTML (même rendu que le .docx) ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  L.html = function (paras) {
    return paras.map(function (p) {
      var s = 'margin:' + ((p.sp.before || 0) / 20) + 'pt 0 ' + ((p.sp.after || 0) / 20) + 'pt;' + (p.jc === 'center' ? 'text-align:center;' : '') + (p.sp.line ? 'line-height:' + (p.sp.line / 240 * 1.15).toFixed(2) + ';' : 'line-height:1.15;');
      if (p.bord) s += 'border-bottom:' + (p.bord.sz > 2 ? '1px' : '0.5px') + ' solid #' + p.bord.color + ';height:0;';
      var contenu = p.runs.map(function (r) {
        var st = r.st, css = 'font-family:' + (st.f === 'Georgia' ? 'Georgia,serif' : 'Calibri,Carlito,sans-serif') + ';font-size:' + (st.sz / 2) + 'pt;color:#' + st.c + ';' +
          (st.b ? 'font-weight:700;' : '') + (st.i ? 'font-style:italic;' : '') + (st.u ? 'text-decoration:underline;' : '') + (st.sp ? 'letter-spacing:' + (st.sp / 20) + 'pt;' : '');
        var x = esc(r.x).replace(/\[([A-Za-z_]+)\]/g, '<mark class="kbs">[$1]</mark>').replace(/\{([A-Za-z]+)\}/g, '<mark class="manque">{$1}</mark>');
        if (r.lien && /^(https:\/\/|mailto:)/i.test(r.lien)) return '<a style="' + css + '" href="' + esc(r.lien) + '" title="' + esc(r.lien) + '" target="_blank" rel="noopener noreferrer">' + x + '</a>';
        if (r.lien) return '<span style="' + css + '" title="Lien : ' + esc(r.lien) + '">' + x + '</span>';
        return '<span style="' + css + '">' + x + '</span>';
      }).join('');
      return '<p style="' + s + '">' + (contenu || '') + '</p>';
    }).join('');
  };

  /* ---------- .docx ---------- */
  /* caractères interdits en XML (souvent collés depuis Word : saut de ligne manuel \v…) */
  var RE_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g;
  L.nettoyer = function (s) { return String(s).replace(/[\u000B\u000C]/g, ' ').replace(RE_INTERDITS, ''); };
  function x(s) { return L.nettoyer(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  function runXml(r) {
    var st = r.st, f = st.f;
    return '<w:r><w:rPr><w:rFonts w:ascii="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '" w:hAnsi="' + f + '"/>' +
      (st.b ? '<w:b/><w:bCs/>' : '') + (st.i ? '<w:i/><w:iCs/>' : '') +
      '<w:color w:val="' + st.c + '"/>' + (st.sp ? '<w:spacing w:val="' + st.sp + '"/>' : '') +
      '<w:sz w:val="' + st.sz + '"/><w:szCs w:val="' + st.sz + '"/>' + (st.u ? '<w:u w:val="single"/>' : '') +
      '</w:rPr><w:t xml:space="preserve">' + x(r.x) + '</w:t></w:r>';
  }
  L.documentXml = function (paras, gabarit) {
    var G = L.GABARITS[gabarit] || L.GABARITS.presentiel, liens = [], corps = '';
    paras.forEach(function (p) {
      var ppr = '';
      if (p.bord) ppr += '<w:pBdr><w:bottom w:val="single" w:color="' + p.bord.color + '" w:sz="' + p.bord.sz + '"' + (p.bord.space != null ? ' w:space="' + p.bord.space + '"' : '') + '/></w:pBdr>';
      var sp = '';
      if (p.sp.after != null) sp += ' w:after="' + p.sp.after + '"';
      if (p.sp.before != null) sp += ' w:before="' + p.sp.before + '"';
      if (p.sp.line != null) sp += ' w:line="' + p.sp.line + '"';
      if (sp) ppr += '<w:spacing' + sp + '/>';
      if (p.jc) ppr += '<w:jc w:val="' + p.jc + '"/>';
      corps += '<w:p><w:pPr>' + ppr + '</w:pPr>' + p.runs.map(function (r) {
        if (!r.lien) return runXml(r);
        var id = 'rIdL' + (liens.length + 1);
        liens.push({ id: id, cible: r.lien });
        return '<w:hyperlink w:history="1" r:id="' + id + '">' + runXml(r) + '</w:hyperlink>';
      }).join('') + '</w:p>';
    });
    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
      corps + '<w:sectPr>' + G.page + '<w:pgNumType/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>';
    return { document: doc, liens: liens };
  };
  L.docx = function (paras, gabarit, titre) {
    var B = g.LettresBase;
    if (!B) throw new Error('lettres-base.js manquant');
    var d = L.documentXml(paras, gabarit), maintenant = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      d.liens.map(function (l) { return '<Relationship Id="' + l.id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + x(l.cible) + '" TargetMode="External"/>'; }).join('') +
      '</Relationships>';
    var fichiers = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'],
      ['docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(titre || '') + '</dc:title><dc:creator>CMK France — Lettres KBS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + maintenant + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + maintenant + '</dcterms:modified></cp:coreProperties>'],
      ['docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>CMK France — Lettres KBS</Application></Properties>'],
      ['word/document.xml', d.document],
      ['word/_rels/document.xml.rels', rels],
      ['word/styles.xml', B.styles[(L.GABARITS[gabarit] && L.GABARITS[gabarit].styles) || gabarit] || B.styles.presentiel],
      ['word/settings.xml', B.settings]
    ];
    return L.zip(fichiers);
  };

  /* ---------- ZIP (sans compression : Word l'accepte, aucune dépendance) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  L.zip = function (fichiers) {
    var d = new Date(), heureDos = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dateDos = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var morceaux = [], central = [], decalage = 0;
    fichiers.forEach(function (f) {
      var nom = utf8(f[0]), data = f[1] instanceof Uint8Array ? f[1] : utf8(f[1]), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, heureDos, true); h.setUint16(12, dateDos, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
      morceaux.push(new Uint8Array(h.buffer), nom, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, heureDos, true); c.setUint16(14, dateDos, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nom.length, true);
      c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, decalage, true);
      central.push(new Uint8Array(c.buffer), nom);
      decalage += 30 + nom.length + data.length;
    });
    var tailleC = central.reduce(function (s, u) { return s + u.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, fichiers.length, true); e.setUint16(10, fichiers.length, true);
    e.setUint32(12, tailleC, true); e.setUint32(16, decalage, true);
    var tout = morceaux.concat(central, [new Uint8Array(e.buffer)]), n = tout.reduce(function (s, u) { return s + u.length; }, 0), out = new Uint8Array(n), p = 0;
    tout.forEach(function (u) { out.set(u, p); p += u.length; });
    return out;
  };

  /* ---------- Type d'événement ----------
     « celebration » : Célébration du Dharma (jamais « Festival », « festivaliers »)
     « festival »    : Festival (ex. Festival français 2027)
     « autre »       : ni l'un ni l'autre (retraite…)
     Même règle que /commun/fiche.js : champ typeEvenement, sinon déduit du nom français. */
  L.TYPES = { celebration: 'Célébration', festival: 'Festival', autre: 'Autre' };
  L.typeDuNom = function (nom) {
    var n = String(nom || '');
    return /festival/i.test(n) ? 'festival' : /c[ée]l[ée]bration/i.test(n) ? 'celebration' : 'autre';
  };
  L.typeFiche = function (fiche) {
    fiche = fiche || {};
    var connu = function (v) { return typeof v === 'string' && Object.prototype.hasOwnProperty.call(L.TYPES, v); };
    if (connu(fiche.typeEvenement)) return fiche.typeEvenement;
    if (connu(fiche.type)) return fiche.type;   /* fiche préparée par fiche.js */
    return L.typeDuNom(t(fiche.nom, 'fr'));
  };

  /* ---------- Morceaux protégés d'un texte ----------
     jamais modifiés par un remplacement, jamais lus par les vérifications de termes :
     adresse d'un lien « ](…) », variable KBS [x], valeur {x}, adresse e-mail, adresse web en clair */
  var RE_PROTEGE = /\]\((?:[^()\s]|\([^()\s]*\))+\)|\[[A-Za-z_]+\](?!\()|\{[A-Za-z]+\}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b(?:https?:\/\/|www\.)[^\s<>()\[\]]+/g;
  /* → [[texte, modifiable], …] */
  L.morceaux = function (s) {
    var out = [], i = 0, m; s = String(s || ''); RE_PROTEGE.lastIndex = 0;
    while ((m = RE_PROTEGE.exec(s))) { if (m.index > i) out.push([s.slice(i, m.index), true]); out.push([m[0], false]); i = RE_PROTEGE.lastIndex; }
    if (i < s.length) out.push([s.slice(i), true]);
    return out;
  };

  /* ---------- Reprise des lettres d'un autre type d'événement ----------
     L.planReprise({ type, nom: {fr,en} } source, { type, nom } cible) → règles ;
     L.appliquerReprise(texte, lang, plan) → { texte, n, exemples: [[avant, après]] }.
     Remplace d'abord le nom de l'événement source (s'il est écrit en toutes lettres) par celui
     de la cible, puis Célébration ↔ Festival avec l'accord (la Célébration → le Festival,
     de la → du, à la → au, cette → ce…), et l'article devant {evenement}. Les morceaux
     protégés (voir plus haut) ne sont jamais touchés. */
  var LETTRE = 'A-Za-zÀ-ÖØ-öø-ÿŒœ';
  var ART_F_M = { 'à la ': 'au ', 'de la ': 'du ', 'la ': 'le ', 'cette ': 'ce ', 'une ': 'un ', 'toute la ': 'tout le ' };
  var ADJ_F_M = { 'prochaine ': 'prochain ', 'dernière ': 'dernier ', 'belle ': 'beau ', 'nouvelle ': 'nouveau ', 'grande ': 'grand ', 'première ': 'premier ' };
  function inverser(o) { var r = {}; Object.keys(o).forEach(function (k) { r[o[k]] = k; }); return r; }
  var ART_M_F = inverser(ART_F_M), ADJ_M_F = inverser(ADJ_F_M);
  ADJ_M_F['bel '] = 'belle '; ADJ_M_F['nouvel '] = 'nouvelle ';
  function genre(nom) { var p = String(nom || '').trim().split(/\s+/)[0] || ''; return /^c[ée]l[ée]bration/i.test(p) ? 'f' : /^festival/i.test(p) ? 'm' : ''; }
  function echapper(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function casse(modele, s) { return modele && modele.charAt(0) === modele.charAt(0).toUpperCase() && modele.charAt(0) !== modele.charAt(0).toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  L.planReprise = function (src, cible) {
    var ts = src.type, tc = cible.type, regles = { fr: [], en: [] };
    var nomS = { fr: t(src.nom, 'fr'), en: t(src.nom, 'en') }, nomC = { fr: t(cible.nom, 'fr'), en: t(cible.nom, 'en') };
    var change = (ts === 'celebration' && tc === 'festival') || (ts === 'festival' && tc === 'celebration');
    ['fr', 'en'].forEach(function (lang) {
      /* noms : [texte cherché, remplacement, genre du remplacement] (le plus long d'abord) */
      var noms = [];
      [[nomS.fr, nomC.fr], [nomS.en, nomC.en || nomC.fr]].forEach(function (p) {
        if (p[0] && p[1] && p[0] !== p[1] && !noms.some(function (x) { return x[0] === p[0]; })) noms.push([p[0], p[1], genre(p[1]), genre(p[0])]);
      });
      if (change && ts === 'celebration') {
        if (lang === 'fr') noms.push(['Célébration du Dharma', 'Festival', 'm', 'f'], ['Célébrations', 'Festivals', 'm', 'f'], ['Célébration', 'Festival', 'm', 'f'], ['célébrations', 'festivals', 'm', 'f'], ['célébration', 'festival', 'm', 'f']);
        else noms.push(['Dharma Celebrations', 'Festivals'], ['Dharma Celebration', 'Festival'], ['Celebrations', 'Festivals'], ['Celebration', 'Festival'], ['celebrations', 'festivals'], ['celebration', 'festival']);
      } else if (change) {
        if (lang === 'fr') noms.push(['Festivals', 'Célébrations', 'f', 'm'], ['Festival', 'Célébration', 'f', 'm'], ['festivals', 'célébrations', 'f', 'm'], ['festival', 'célébration', 'f', 'm'],
          ['festivalières', 'participantes'], ['festivalière', 'participante'], ['festivaliers', 'participants'], ['festivalier', 'participant'], ['Festivaliers', 'Participants']);
        else noms.push(['Festivals', 'Celebrations'], ['Festival', 'Celebration'], ['festivals', 'celebrations'], ['festival', 'celebration'], ['festival-goers', 'participants'], ['Festival-goers', 'Participants']);
      }
      noms.sort(function (a, b) { return b[0].length - a[0].length; });
      regles[lang] = noms;
    });
    /* article devant {evenement} si le nom change de genre */
    var gS = genre(nomS.fr), gC = genre(nomC.fr);
    return { regles: regles, evenement: gS && gC && gS !== gC ? (gS === 'f' ? ART_F_M : ART_M_F) : null, change: change };
  };
  L.appliquerReprise = function (texte, lang, plan) {
    var noms = plan.regles[lang] || [], n = 0, exemples = [];
    if (!noms.length && !(lang === 'fr' && plan.evenement)) return { texte: texte, n: 0, exemples: [] };
    var arts = lang === 'fr' ? Object.keys(ART_F_M).concat(Object.keys(ART_M_F)).filter(function (x, i, a) { return a.indexOf(x) === i; }) : [];
    arts.sort(function (a, b) { return b.length - a.length; });
    var adjs = lang === 'fr' ? Object.keys(ADJ_F_M).concat(Object.keys(ADJ_M_F)).filter(function (x, i, a) { return a.indexOf(x) === i; }) : [];
    var alt = function (l) { return l.map(function (x) { return x.replace(/^./, function (c) { return '[' + c.toLowerCase() + c.toUpperCase() + ']'; }).replace(/ /g, '\\s+'); }).join('|'); };
    var re = noms.length ? new RegExp('(?<![' + LETTRE + '-])' + (arts.length ? '((?:' + alt(arts) + '))?' : '()') + (adjs.length ? '((?:' + alt(adjs) + '))?' : '()') +
      '(' + noms.map(function (x) { return echapper(x[0]); }).join('|') + ')(?![' + LETTRE + '@-])', 'g') : null;
    var parNom = {}; noms.forEach(function (x) { parNom[x[0]] = x; });
    var accord = function (mot, table) {
      if (!mot) return '';
      var cle = mot.toLowerCase().replace(/\s+/g, ' ');
      var v = table[cle];
      return v == null ? mot : casse(mot, v);
    };
    var m = L.morceaux(texte), sortie = m.map(function (p, i) {
      if (!p[1]) return p[0];
      var s = p[0];
      if (re) s = s.replace(re, function (tout, art, adj, nom) {
        var r = parNom[nom], gC = r[2], gS = r[3], table = gS === 'f' && gC === 'm' ? { a: ART_F_M, j: ADJ_F_M } : gS === 'm' && gC === 'f' ? { a: ART_M_F, j: ADJ_M_F } : null;
        var apres = (table ? accord(art, table.a) + accord(adj, table.j) : (art || '') + (adj || '')) + r[1];
        n++; exemples.push([tout, apres]);
        return apres;
      });
      /* article juste avant {evenement} */
      var suivant = m[i + 1];
      if (lang === 'fr' && plan.evenement && suivant && suivant[0] === '{evenement}') {
        var ra = new RegExp('(?<![' + LETTRE + '])(' + alt(Object.keys(plan.evenement).sort(function (a, b) { return b.length - a.length; })) + ')$');
        s = s.replace(ra, function (art) { var apres = accord(art, plan.evenement); if (apres !== art) { n++; exemples.push([art + '{evenement}', apres + '{evenement}']); } return apres; });
      }
      return s;
    }).join('');
    return { texte: sortie, n: n, exemples: exemples };
  };

  /* ---------- Vérificateur KBS ----------
     contexte : { valeurs, lang, fiche }  → { erreurs: [{ n, texte }], avertissements: [...] } */
  var RE_MARQUEURS = />>>[^<>]{0,60}<<<|>>>|<<<|À INSÉRER|A INSERER|TO BE INSERTED|\bTODO\b|\bXXX\b/i;
  var RE_FESTIVAL = new RegExp('(?<![' + LETTRE + '])festivals?(?![' + LETTRE + '-])', 'i');
  var RE_FESTIVALIERS = /festivali[eè]re?s?|festival-goers?/i;
  var RE_CELEBRATION = new RegExp('(?<![' + LETTRE + '])c[ée]l[ée]brations?(?![' + LETTRE + '])', 'i');
  var RE_POUVOIR = /transmissions?\s+de\s+pouvoirs?/i, RE_EMPOWERMENT = /\bempowerments?\b/i;
  var RE_ACCORD_F = new RegExp('(?<![' + LETTRE + '])(à la|de la|la|cette|une|toute la)\\s+(festival)(?![' + LETTRE + '])', 'i');
  var RE_ACCORD_M = new RegExp('(?<![' + LETTRE + '])(au|du|le|ce|un|tout le)\\s+(c[ée]l[ée]bration)(?![' + LETTRE + '])', 'i');
  L.verifier = function (texte, contexte) {
    var E = [], W = [], V = contexte.valeurs || {}, lang = contexte.lang || 'fr', fiche = contexte.fiche || {};
    var e = function (n, s) { E.push({ n: n, texte: s }); }, w = function (n, s) { W.push({ n: n, texte: s }); };
    var langue = lang === 'en' ? 'anglais' : 'français';
    var type = L.typeFiche(fiche), vus = { festival: 0, celebration: 0 };
    /* noms de l'événement : jamais signalés (ex. « Célébration » dans le nom d'un Festival) */
    var nomsEvt = [t(fiche.nom, 'fr'), t(fiche.nom, 'en'), V.evenement && V.evenement.fr, V.evenement && V.evenement.en].filter(function (x) { return x && x.length > 3; })
      .sort(function (a, b) { return b.length - a.length; });
    var blocs = L.analyser(texte);
    if (!blocs.some(function (b) { return b.t === 'entete'; })) w(null, 'Pas d\'en-tête (@entete).');
    if (!blocs.some(function (b) { return b.t === 'titre'; })) w(null, 'Pas de titre (ligne « # Titre »).');
    var annee = dv(fiche.debut) ? fiche.debut.slice(0, 4) : null, anneeFin = dv(fiche.fin) ? fiche.fin.slice(0, 4) : annee;
    var requises = function (n, cles, ou) {
      cles.forEach(function (k) { if (!(V[k] && V[k][lang])) e(n, ou + ' : la valeur {' + k + '} est vide en ' + langue + ' (onglet Valeurs).'); });
    };
    blocs.forEach(function (b) {
      if (b.t === 'inconnu') { e(b.n, b.msg || ('Commande inconnue « ' + b.x.split(/\s/)[0] + ' ».')); return; }
      if (b.t === 'entete') { requises(b.n, ['centre', 'evenement', 'dates'], 'En-tête'); return; }
      if (b.t === 'signature') { requises(b.n, ['formule', 'equipe', 'centre', 'contact'], 'Signature'); return; }
      if (b.suspect) w(b.n, 'Ligne lue comme un paragraphe : il manque sans doute une espace après « ' + /^(##?|!!|-)/.exec(b.x)[0] + ' ».');
      var brut = b.x || '';
      /* valeurs de l'événement */
      brut.replace(/\{([A-Za-z]+)\}/g, function (m, k) {
        if (!CLES[k]) e(b.n, 'Valeur inconnue {' + k + '} (voir la liste dans l\'onglet Valeurs).');
        else if (!(V[k] && V[k][lang])) e(b.n, 'Valeur {' + k + '} vide en ' + langue + ' : à remplir dans l\'onglet Valeurs.');
        return m;
      });
      var s = L.resoudre(brut, V, lang);
      if (RE_MARQUEURS.test(s)) e(b.n, 'Texte à compléter (« ' + RE_MARQUEURS.exec(s)[0] + ' ») : remplacez-le avant l\'envoi à KBS.');
      if (/\/edit(\b|\?|#|$)/.test(s)) e(b.n, 'Lien de modification (/edit) : ne jamais diffuser, utilisez le lien public (/viewform).');
      /* variables KBS */
      var sansLiens = s.replace(RE_LIEN, function (m, txt, url) { return txt + ' ' + (/^\[[A-Za-z_]+\]$/.test(url) ? url : ''); });
      sansLiens.replace(/\[\s+([A-Za-z_]+)\s*\]|\[([A-Za-z_]+)\s+\]/g, function (m, v1, v2) {
        var v = v1 || v2, exact = L.VARIABLES_KBS.filter(function (k) { return k.toLowerCase() === v.toLowerCase(); })[0];
        e(b.n, 'Espace dans « ' + m + ' » : KBS ne reconnaîtra pas la variable.' + (exact ? ' Écrivez [' + exact + '].' : ''));
        return m;
      });
      sansLiens.replace(/\[([A-Za-z_][A-Za-z0-9_]{0,39})\]/g, function (m, v) {
        if (v === 'groupedOptions') e(b.n, '[groupedOptions] n\'existe pas dans KBS : utilisez [options].');
        else if (L.VARIABLES_KBS.indexOf(v) < 0) {
          var proche = L.VARIABLES_KBS.filter(function (k) { return k.toLowerCase() === v.toLowerCase(); })[0];
          e(b.n, 'Variable KBS inconnue [' + v + '] : KBS ne la remplacera pas.' + (proche ? ' Vouliez-vous dire [' + proche + '] ?' : ''));
        }
        return m;
      });
      /* liens */
      RE_LIEN.lastIndex = 0;
      var m;
      while ((m = RE_LIEN.exec(s))) {
        var txt = m[1], url = m[2];
        if (/^\[([A-Za-z_]+)\]$/.test(url)) { if (LIENS_KBS.indexOf(url.slice(1, -1)) < 0) w(b.n, 'Lien vers la variable ' + url + ' : vérifiez qu\'elle contient bien une adresse.'); }
        else if (!/^(https:\/\/|mailto:)/.test(url)) e(b.n, 'Adresse de lien invalide « ' + url + ' » (https://… ou mailto:…).');
        if (/docs\.google\.com\/forms\/d\/1F61yPfjRNji5F4DtnC2aDMqu/.test(url)) e(b.n, 'Ancien formulaire navettes, fermé : utilisez le lien actuel.');
        if (fiche.formulairesTest && /\/(navettes|benevolat)\/\?evt=/.test(url)) w(b.n, 'Ce lien mène à un formulaire encore « en test » (case cochée dans Préparer).');
        if (!txt.trim()) e(b.n, 'Lien sans texte.');
        if (L.VARIABLES_KBS.indexOf(txt.trim()) > -1) w(b.n, 'Le texte du lien « ' + txt + ' » est un nom de variable KBS : pour afficher la variable, écrivez [' + txt.trim() + '] hors du lien.');
        if (s.charAt(RE_LIEN.lastIndex) === ')') w(b.n, 'Parenthèse « ) » juste après le lien « ' + txt + ' » : l\'adresse contient peut-être des parenthèses mal fermées.');
      }
      /* texte lu par le participant (sans adresses ni liens mail) */
      var texteSeul = s.replace(RE_LIEN, function (m, txt, url) { return /^mailto:/i.test(url) ? ' ' : txt; }).replace(RE_MAIL, ' ');
      if (/https?:\/\//.test(texteSeul)) w(b.n, 'Adresse affichée en clair : mettez-la derrière un texte, [texte](adresse).');
      /* variable-lien KBS affichée dans le texte (et non cachée derrière un texte) */
      (texteSeul.match(/\[(yourCart|yourAccount|yourAccountOrCart|yourBooking|bookingUrl)\]/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i; }).forEach(function (v) {
        w(b.n, v + ' est affiché dans le texte : selon KBS, il deviendra une adresse en clair ou un lien. Vérifiez-le dans un envoi test, ou cachez-le derrière un texte : [' + (/Cart/.test(v) ? (lang === 'en' ? 'your cart' : 'votre panier') : /Account/.test(v) ? (lang === 'en' ? 'your account' : 'votre compte') : (lang === 'en' ? 'your booking' : 'votre inscription')) + '](' + v + ').');
      });
      /* termes : texte écrit dans la lettre (sans les valeurs venues de la fiche, les variables KBS,
         les adresses web ou e-mail, ni le nom de l'événement) */
      var ecrit = brut.replace(RE_LIEN, function (m, txt, url) { return /^mailto:/i.test(url) ? ' ' : txt; })
        .replace(/\{([A-Za-z]+)\}/g, function (m, k) { var x = V[k]; return x && x.source && x.source[lang] === 'lettres' ? ' ' + x[lang] + ' ' : ' '; });
      var termes = L.morceaux(ecrit).map(function (p) { return p[1] ? p[0] : ' '; }).join('');
      nomsEvt.forEach(function (nom) { termes = termes.split(nom).join(' '); });
      var lu = L.morceaux(texteSeul).map(function (p) { return p[1] ? p[0] : ' '; }).join('');
      var fest = RE_FESTIVAL.exec(termes), cel = RE_CELEBRATION.exec(termes), fl = RE_FESTIVALIERS.exec(termes);
      if (fest) vus.festival = vus.festival || b.n || -1;
      if (cel) vus.celebration = vus.celebration || b.n || -1;
      if (type === 'celebration') {
        if (fl) e(b.n, '« ' + fl[0] + ' » : utilisez « participants » (cet événement est une Célébration).');
        if (fest) e(b.n, '« ' + fest[0] + ' » : utilisez « ' + (lang === 'en' ? 'Celebration' : 'Célébration') + ' » (terme officiel de cet événement).');
      } else if (type === 'festival') {
        if (cel) e(b.n, '« ' + cel[0] + ' » : cet événement est un Festival. « ' + cel[0] + ' » vient sans doute de la lettre copiée : écrivez « Festival »' + (lang === 'en' ? '.' : ' (le Festival, du Festival, au Festival).'));
        if (fl) w(b.n, '« ' + fl[0] + ' » : préférez « participants ».');
      }
      /* accord en français (souvent après un remplacement) : « la Festival », « au Célébration »… */
      var ac;
      if (lang === 'fr' && (ac = RE_ACCORD_F.exec(lu))) e(b.n, 'Accord : « ' + ac[0] + ' » → « ' + ({ 'à la': 'au', 'de la': 'du', 'la': 'le', 'cette': 'ce', 'une': 'un', 'toute la': 'tout le' })[ac[1].toLowerCase()] + ' ' + ac[2] + ' » (Festival est masculin).');
      if (lang === 'fr' && (ac = RE_ACCORD_M.exec(lu))) e(b.n, 'Accord : « ' + ac[0] + ' » → « ' + ({ 'au': 'à la', 'du': 'de la', 'le': 'la', 'ce': 'cette', 'un': 'une', 'tout le': 'toute la' })[ac[1].toLowerCase()] + ' ' + ac[2] + ' » (Célébration est féminin).');
      var pv;
      if ((pv = RE_POUVOIR.exec(termes))) w(b.n, '« ' + pv[0] + ' » : écrivez « transmission des bénédictions ».');
      if ((pv = RE_EMPOWERMENT.exec(termes))) w(b.n, '« ' + pv[0] + ' » : écrivez « blessing » (ex. « transmission of blessings », « Blessing »).');
      if (annee) (texteSeul.match(/\b20\d\d\b/g) || []).forEach(function (y) { if (y !== annee && y !== anneeFin) w(b.n, 'Année ' + y + ' : l\'événement a lieu en ' + annee + '.'); });
      /* mise en forme restée visible */
      if ((brut.match(/\*\*/g) || []).length % 2) w(b.n, 'Gras (**) mal fermé.');
      else if ((brut.replace(/\*\*/g, '').replace(RE_LIEN, '').match(/\*/g) || []).length % 2) w(b.n, 'Italique (*) mal fermé.');
      else if (L.enLigne(s).some(function (r) { return /\*|\]\(/.test(r.x); })) w(b.n, 'Des signes « * » ou « ](» resteront visibles dans la lettre : vérifiez le gras, l\'italique et les liens.');
    });
    if (type === 'autre' && vus.festival && vus.celebration) {
      var ln = Math.max(vus.festival, vus.celebration);
      w(ln > 0 ? ln : null, 'La lettre parle à la fois de « Festival » et de « Célébration » : gardez un seul terme pour cet événement.');
    }
    return { erreurs: E, avertissements: W };
  };

  /* Nom de fichier : CD2026_04_Confirmation_FR.docx / CD2026_Streaming_04_Confirmation_FR.docx */
  L.nomFichier = function (code, lettre, gabarit, lang) {
    var nf = lettre.fichier && lettre.fichier[gabarit] && lettre.fichier[gabarit][lang] || t(lettre.nom, lang) || lettre.id;
    nf = String(nf).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    var propre = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_|_$/g, ''); };
    var num = propre(lettre.num);
    return (propre(code) || 'EVT') + '_' + (gabarit === 'streaming' ? 'Streaming_' : '') + (num ? num + '_' : '') + (nf || 'Lettre') + '_' + lang.toUpperCase() + '.docx';
  };
  /* Tout en une fois : texte → { paras, html, docx(), verif } */
  L.preparer = function (texte, gabarit, lang, valeurs, fiche) {
    if (!L.GABARITS[gabarit]) gabarit = 'presentiel';
    var blocs = L.analyser(texte), paras = L.paragraphes(blocs, gabarit, lang, valeurs);
    return { blocs: blocs, paras: paras, verif: L.verifier(texte, { valeurs: valeurs, lang: lang, fiche: fiche }) };
  };

  L.t = t; L.jour = jour; L.heure = heure; L.esc = esc;
  g.Lettres = L;
})(typeof window !== 'undefined' ? window : globalThis);
