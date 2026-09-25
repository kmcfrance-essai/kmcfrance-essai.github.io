/* =========================================================
   formulaires-admin.js — page d'admin d'un formulaire (CMK France)
   Utilisé par /navettes/admin.html et /benevolat/admin.html.

   Formulaires.admin({ outil: 'navettes', modele: function (fiche) { return contenu; } })

   Connexion : un mot de passe par outil, créé à la première utilisation.
   Techniquement, c'est un compte Firebase Authentication au nom de
   admin-<outil>@kmcfrance.github.io (aucun e-mail n'y est envoyé).
   Dépend de : fiche.js, formulaires.js, qrcode.js (facultatif), SDK Firebase compat
   (app, auth, firestore).
   ========================================================= */
(function (global) {
  'use strict';
  var F = global.Formulaires;
  if (!F) throw new Error('formulaires.js doit être chargé avant formulaires-admin.js');
  var U = F.util, D = F.dates, el = U.el, esc = U.esc, t = U.t, clone = U.clone;
  var CONTENU = ['titre', 'intro', 'questions', 'merci', 'ferme', 'rgpd', 'contact'];
  var OPTIONS_TYPES = { choix: 1, liste: 1, cases: 1 };

  var ICO = {
    haut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
    bas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>',
    copie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    oeil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    oeilBarre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.8 10.8 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.1-5.9M9.9 5.2A10 10 0 0 1 12 5c7 0 11 7 11 7a19.9 19.9 0 0 1-2.2 3.2"/><path d="M1 1l22 22"/></svg>',
    corbeille: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- petites aides d'interface ---------- */
  var toastEnCours = null;
  function toast(texte) {
    if (toastEnCours) { clearTimeout(toastEnCours.minuterie); toastEnCours.remove(); }
    var n = el('div', { class: 'toast', role: 'status', text: texte });
    document.body.appendChild(n);
    n.minuterie = setTimeout(function () { n.remove(); if (toastEnCours === n) toastEnCours = null; }, Math.max(2600, texte.length * 55));
    toastEnCours = n;
  }
  function copier(texte) {
    var ok = function () { toast('Copié'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, function () { global.prompt('Copiez :', texte); });
    else global.prompt('Copiez :', texte);
  }
  /* Boîte de dialogue : boutons = [{ texte, classe, action(dlg) → false pour ne pas fermer }] */
  function dialogue(o) {
    var idT = U.uid('dlg');
    var dlg = el('dialog', { class: o.classe || '', 'aria-labelledby': idT });
    var fermer = function () { if (dlg.open) dlg.close(); };
    dlg.appendChild(el('div', { class: 'dlg-head' }, [el('h2', { id: idT, text: o.titre }), el('button', { class: 'x', type: 'button', 'aria-label': 'Fermer', html: '&times;', onclick: fermer })]));
    var corps = el('div', { class: 'dlg-body' });
    (Array.isArray(o.corps) ? o.corps : [o.corps]).forEach(function (c) { if (c) corps.appendChild(typeof c === 'string' ? el('p', { html: c }) : c); });
    dlg.appendChild(corps);
    if (o.boutons && o.boutons.length) {
      var pied = el('div', { class: 'dlg-foot' });
      o.boutons.forEach(function (b) {
        var bt = el('button', { class: 'btn ' + (b.classe || 'btn-g'), type: 'button', text: b.texte });
        bt.addEventListener('click', function () {
          var r = b.action ? b.action(dlg, bt) : undefined;
          Promise.resolve(r).then(function (v) { if (v !== false) fermer(); });
        });
        pied.appendChild(bt);
      });
      dlg.appendChild(pied);
    }
    dlg.addEventListener('close', function () { dlg.remove(); if (o.apresFermeture) o.apresFermeture(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    return dlg;
  }
  function confirmer(titre, texte, libelle, danger) {
    return new Promise(function (ok) {
      var rep = false;
      dialogue({
        titre: titre, corps: texte,
        boutons: [{ texte: 'Annuler' }, { texte: libelle || 'Confirmer', classe: danger ? 'btn-danger' : 'btn-t', action: function () { rep = true; } }],
        apresFermeture: function () { ok(rep); }
      });
    });
  }
  function champ(label, input, aide) {
    var id = input.id || U.uid('c');
    input.id = id;
    return el('div', { class: 'fld' }, [el('label', { for: id, text: label }), input, aide ? el('p', { class: 'aide', html: aide }) : null]);
  }
  function genererMotDePasse() {
    var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', n = new Uint32Array(16), s = '';
    (global.crypto || global.msCrypto).getRandomValues(n);
    for (var i = 0; i < 16; i++) { s += a[n[i] % a.length]; if (i % 4 === 3 && i < 15) s += '-'; }
    return s;
  }
  function msgAuth(e) {
    var c = F.codeErreur(e);
    var m = {
      'auth/invalid-credential': 'Mot de passe incorrect. (Si le mot de passe de l\'outil n\'a jamais été créé : « Première utilisation », plus bas.)',
      'auth/wrong-password': 'Mot de passe incorrect.', 'auth/invalid-login-credentials': 'Mot de passe incorrect. (Si le mot de passe de l\'outil n\'a jamais été créé : « Première utilisation », plus bas.)',
      'auth/user-not-found': 'Le mot de passe de cet outil n\'a pas encore été créé : utilisez « Première utilisation ».',
      'auth/too-many-requests': 'Trop d\'essais : patientez quelques minutes puis réessayez.',
      'auth/network-request-failed': 'Pas de connexion internet.',
      'auth/operation-not-allowed': 'La connexion par mot de passe n\'est pas activée dans Firebase (Authentication → Méthodes de connexion → E-mail/Mot de passe). Voir FORMULAIRES.md.',
      'auth/configuration-not-found': 'Firebase Authentication n\'est pas activé pour ce projet (Authentication → Commencer). Voir FORMULAIRES.md.',
      'auth/admin-restricted-operation': 'La création de comptes est désactivée dans Firebase (Authentication → Paramètres → Actions des utilisateurs). Voir FORMULAIRES.md, « Mot de passe perdu ».',
      'auth/email-already-in-use': 'Le mot de passe de cet outil existe déjà : utilisez « Connexion ». En cas d\'oubli, suivez « Mot de passe perdu » dans FORMULAIRES.md.',
      'auth/weak-password': 'Mot de passe trop faible.',
      'auth/requires-recent-login': 'Par sécurité, reconnectez-vous puis recommencez.',
      'auth/invalid-api-key': 'Configuration Firebase invalide (clé API) : vérifiez la section « Formulaires » de la fiche.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Configuration Firebase invalide (clé API) : vérifiez la section « Formulaires » de la fiche.'
    }[c];
    return m || ('Erreur : ' + (e && e.message ? e.message : c));
  }
  function msgDonnees(e) {
    var c = F.codeErreur(e);
    if (c === 'permission-denied') return 'Accès refusé par Firebase. Vérifiez que les règles de sécurité (fichier /commun/firestore-formulaires.rules) sont bien publiées, puis reconnectez-vous.';
    if (c === 'unavailable') return 'Firebase ne répond pas (connexion internet ?).';
    return 'Erreur : ' + (e && e.message ? e.message : c);
  }
  /* Retire les valeurs vides ('' , null, false, objets vides) : deux contenus équivalents
     se comparent à l'identique, et Firestore ne reçoit jamais de valeur « undefined ». */
  function nettoyer(v) {
    if (Array.isArray(v)) return v.map(nettoyer);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) {
        var x = nettoyer(v[k]);
        if (x === '' || x == null || x === false) return;
        if (typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length) return;
        o[k] = x;
      });
      return o;
    }
    return v;
  }
  function canon(c) {
    var o = {};
    CONTENU.forEach(function (k) { if (c && c[k] !== undefined) o[k] = c[k]; });
    o = nettoyer(JSON.parse(JSON.stringify(o)));
    if (!Array.isArray(o.questions)) o.questions = [];
    return o;
  }
  function identiques(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }
  function versDate(x) { return x && typeof x.toDate === 'function' ? x.toDate() : x instanceof Date ? x : null; }
  function aujourdhuiParis() { return D.dateVersParis(new Date()).slice(0, 10); }
  function nomQ(q, i) { return (q.type === 'section' ? 'Titre de partie' : 'Question ' + (i + 1)) + (t(q.label, 'fr') ? ' « ' + t(q.label, 'fr') + ' »' : ''); }

  /* Décale toutes les dates d'un contenu de n jours (reprise d'un autre événement) */
  function decalerContenu(c, n) {
    if (!n) return c;
    (c.questions || []).forEach(function (q) {
      (q.jours || []).forEach(function (j) { if (D.dateValide(j.date)) j.date = D.decalerJour(j.date, n); });
      if (q.type === 'date') { if (D.dateValide(q.min)) q.min = D.decalerJour(q.min, n); if (D.dateValide(q.max)) q.max = D.decalerJour(q.max, n); }
    });
    return c;
  }
  function joursEntre(a, b) {
    if (!D.dateValide(a) || !D.dateValide(b)) return 0;
    var x = a.split('-').map(Number), y = b.split('-').map(Number);
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000);
  }

  /* =========================================================
     Page d'admin
     ========================================================= */
  F.admin = function (opts) {
    var outil = opts.outil, NOM = t(F.OUTILS[outil], 'fr'), EMAIL = F.emailAdmin(outil);
    var racine = document.getElementById('app');
    var A = {
      fiche: null, cx: null, docRef: null, repsRef: null,
      doc: null, brouillon: null, reponses: [], charge: false, repsChargees: false,
      onglet: 'reponses', ouverts: {}, filtre: { texte: '', depuis: '' },
      session: U.uid('s'), sale: false, minuterie: null, etatSauve: '', vus: null, neufs: {},
      stop: [], index: null, autres: null
    };
    try { var o = sessionStorage.getItem('form-onglet-' + outil); if (o) A.onglet = o; } catch (e) { /* rien */ }

    /* ---------- squelette ---------- */
    var tete = el('header', { class: 'adm-head' });
    var main = el('main', { id: 'adm-main' });
    var pied = el('footer', { class: 'adm-foot' }, [el('span', { html: 'Mode d\'emploi : <a href="https://github.com/kmcfrance/kmcfrance.github.io/blob/main/commun/FORMULAIRES.md" target="_blank" rel="noopener">FORMULAIRES.md</a> · <a href="/">Hub des outils</a>' }), el('span', { text: F.VERSION })]);
    racine.innerHTML = '';
    racine.appendChild(el('div', { class: 'adm' }, [tete, main, pied]));
    document.title = 'Admin ' + NOM;

    function rendreTete() {
      tete.innerHTML = '';
      var f = A.fiche;
      var gauche = el('div', null, [
        el('p', { class: 'adm-kicker', text: 'Admin · formulaire' }),
        el('h1', { text: NOM }),
        el('p', { class: 'adm-evt', html: f ? '<strong>' + esc(t(f.nom, 'fr')) + '</strong> · ' + esc(f.datesTexte ? f.datesTexte.fr : '') : 'Chargement…' })
      ]);
      var droite = el('div', { class: 'adm-side' });
      if (A.index && (A.index.evenements || []).length > 1 && f) {
        var sel = el('select', { 'aria-label': 'Événement', class: 'btn btn-g btn-sm' });
        A.index.evenements.forEach(function (e) { sel.appendChild(el('option', { value: e.id, text: e.nom + (e.id === A.index.courant ? ' (en cours)' : ''), selected: e.id === f.id })); });
        sel.addEventListener('change', function () { location.search = '?evt=' + encodeURIComponent(sel.value); });
        droite.appendChild(sel);
      }
      if (A.doc) {
        var e = D.etatOuverture(A.doc.ouverture);
        var txt = { ouvert: 'Ouvert', ferme: 'Fermé', bientot: 'Ouvre bientôt', termine: 'Date limite passée' }[e.etat];
        droite.appendChild(el('span', { class: 'pill ' + (e.etat === 'ouvert' ? 'on' : e.etat === 'bientot' ? 'wait' : ''), title: 'État du formulaire public' }, [el('span', { class: 'dot' }), txt]));
      }
      if (f && f.formulairesTest) droite.appendChild(el('span', { class: 'pill wait', title: 'Case « en test » cochée dans la fiche (page Préparer) : lien non diffusé sur le hub, bandeau « version de test » sur le formulaire' }, [el('span', { class: 'dot' }), 'En test']));
      if (f) droite.appendChild(el('a', { class: 'btn btn-g btn-sm', href: lienPublic('fr'), target: '_blank', rel: 'noopener', text: 'Voir le formulaire ↗' }));
      if (A.cx && A.cx.auth && A.cx.auth.currentUser) droite.appendChild(el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Se déconnecter', onclick: function () {
        /* on enregistre d'abord le brouillon en cours */
        (A.sale ? sauvegarder() : Promise.resolve()).then(function () { A.cx.auth.signOut(); });
      } }));
      tete.appendChild(gauche); tete.appendChild(droite);
    }
    function ecran(noeuds) { main.innerHTML = ''; (Array.isArray(noeuds) ? noeuds : [noeuds]).forEach(function (n) { if (n) main.appendChild(n); }); }
    function ecranMessage(titre, html, cls) {
      ecran(el('div', { class: 'card bloc' }, [el('h2', { text: titre }), el('div', { class: 'note ' + (cls || ''), html: html })]));
    }
    function lienPublic(lang) {
      var f = A.fiche, u = (f.outils && f.outils[outil + 'Public']) || (Fiche.BASE + '/' + outil + '/?evt=' + encodeURIComponent(f.id));
      return u + (lang === 'en' ? (u.indexOf('?') > -1 ? '&' : '?') + 'lang=en' : '');
    }

    rendreTete();
    ecran(el('p', { class: 'chargement', text: 'Chargement…' }));

    /* ---------- démarrage ---------- */
    if (!global.Fiche) { ecranMessage('Erreur', 'Le lecteur de fiche (/commun/fiche.js) est introuvable.', 'ko'); return; }
    Fiche.index().then(function (ix) { A.index = ix; }).catch(function () { /* facultatif */ }).then(function () {
      return Fiche.charger();
    }).then(function (f) {
      A.fiche = f;
      rendreTete();
      try { A.cx = F.connecter(f, 'formulaires-' + outil); } catch (e) { ecranMessage('Firebase indisponible', esc(e.message), 'ko'); return; }
      if (!A.cx) {
        ecranMessage('Formulaires pas encore configurés pour cet événement',
          'La fiche de <strong>' + esc(t(f.nom, 'fr')) + '</strong> ne contient pas encore la configuration Firebase des formulaires.<br><br>' +
          'À faire une fois : page <a href="/preparer/?evt=' + encodeURIComponent(f.id) + '">Préparer / modifier l\'événement</a> → section <strong>App &amp; streaming</strong> → <strong>Formulaires</strong>. ' +
          'Mise en place du projet Firebase : <a href="https://github.com/kmcfrance/kmcfrance.github.io/blob/main/commun/FORMULAIRES.md" target="_blank" rel="noopener">FORMULAIRES.md</a>.', 'warn');
        return;
      }
      if (!A.cx.auth) { ecranMessage('Erreur', 'Le module de connexion Firebase ne s\'est pas chargé. Rechargez la page.', 'ko'); return; }
      A.docRef = A.cx.db.doc(F.chemin(f.id, outil));
      A.repsRef = A.cx.db.collection(F.chemin(f.id, outil) + '/reponses');
      A.cx.auth.onAuthStateChanged(function (u) {
        arreter();
        if (u && u.email === EMAIL) demarrer();
        else if (u) { A.cx.auth.signOut(); }
        else { rendreTete(); ecranConnexion(); }
      });
    }).catch(function (e) {
      ecranMessage('Événement introuvable', esc(e && e.message ? e.message : String(e)) + '<br><br><a href="/">Retour au hub</a>', 'ko');
    });

    global.addEventListener('beforeunload', function (ev) { if (A.sale) { ev.preventDefault(); ev.returnValue = ''; } });

    function arreter() {
      A.stop.forEach(function (f) { try { f(); } catch (e) { /* rien */ } });
      A.stop = []; A.doc = null; A.brouillon = null; A.reponses = []; A.charge = false; A.repsChargees = false; A.vus = null; A.erreurReps = null;
      clearTimeout(A.minuterie); A.sale = false;
    }

    /* =========================================================
       Connexion
       ========================================================= */
    function ecranConnexion(message) {
      var fb = A.cx.fb;
      var mdp = el('input', { type: 'password', id: 'mdp', autocomplete: 'current-password', required: true });
      var rester = el('input', { type: 'checkbox', id: 'rester' });
      var m = el('p', { class: 'msg ko', role: 'alert', text: message || '' });
      var bouton = el('button', { class: 'btn btn-t', type: 'submit', text: 'Se connecter' });
      var form = el('form', { novalidate: true }, [
        el('input', { type: 'text', name: 'username', autocomplete: 'username', value: EMAIL, class: 'sr', tabindex: '-1', 'aria-hidden': 'true', readOnly: true }),
        champ('Mot de passe de l\'admin ' + NOM, mdp),
        el('label', { class: 'chk' }, [rester, el('span', { text: 'Rester connecté sur cet ordinateur (ordinateur personnel uniquement)' })]),
        bouton, m
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!mdp.value) { m.textContent = 'Entrez le mot de passe.'; return; }
        bouton.disabled = true; m.textContent = '';
        A.cx.auth.setPersistence(rester.checked ? fb.auth.Auth.Persistence.LOCAL : fb.auth.Auth.Persistence.SESSION)
          .then(function () { return A.cx.auth.signInWithEmailAndPassword(EMAIL, mdp.value); })
          .catch(function (e) { bouton.disabled = false; m.textContent = msgAuth(e); mdp.select(); });
      });
      ecran(el('div', { class: 'card login' }, [
        el('h2', { text: 'Connexion' }),
        el('p', { class: 'muted', text: 'Admin du formulaire ' + NOM + ' : réponses, questions et ouverture. Le mot de passe est partagé par l\'équipe ' + NOM.toLowerCase() + '.' }),
        form,
        el('p', { class: 'small muted', style: 'margin:18px 0 0' }, ['Première utilisation ? ', el('button', { class: 'btn-link', type: 'button', text: 'Créer le mot de passe de l\'outil', onclick: ecranCreation })])
      ]));
      setTimeout(function () { mdp.focus(); }, 50);
    }

    function ecranCreation() {
      var fb = A.cx.fb;
      var mdp = el('input', { type: 'text', id: 'mdp-new', autocomplete: 'new-password', spellcheck: 'false', minlength: '10', required: true, style: 'font-family:ui-monospace,Consolas,monospace' });
      var note = el('input', { type: 'checkbox', id: 'note' });
      var rester = el('input', { type: 'checkbox', id: 'rester2' });
      var m = el('p', { class: 'msg ko', role: 'alert' });
      var bouton = el('button', { class: 'btn btn-o', type: 'submit', text: 'Créer et se connecter' });
      var gen = el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Générer un mot de passe', onclick: function () { mdp.value = genererMotDePasse(); copierBtn.hidden = false; mdp.focus(); mdp.select(); } });
      var copierBtn = el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Copier', hidden: true, onclick: function () { copier(mdp.value); } });
      mdp.addEventListener('input', function () { copierBtn.hidden = !mdp.value; });
      var form = el('form', { novalidate: true }, [
        el('div', { class: 'row' }, [gen, copierBtn]),
        champ('Mot de passe (10 caractères au moins)', mdp, 'Il s\'affiche en clair pour que vous puissiez le noter. Il servira pour tous les événements.'),
        el('label', { class: 'chk' }, [note, el('span', { text: 'J\'ai noté ce mot de passe en lieu sûr (gestionnaire de mots de passe, coffre de l\'équipe…)' })]),
        el('label', { class: 'chk' }, [rester, el('span', { text: 'Rester connecté sur cet ordinateur' })]),
        bouton, m
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = mdp.value;
        if (v.length < 10) { m.textContent = 'Le mot de passe doit faire au moins 10 caractères.'; return; }
        if (v !== v.trim()) { m.textContent = 'Le mot de passe ne doit pas commencer ni finir par une espace.'; return; }
        if (!note.checked) { m.textContent = 'Cochez « J\'ai noté ce mot de passe » : il ne pourra pas être retrouvé.'; return; }
        bouton.disabled = true; m.textContent = '';
        A.cx.auth.setPersistence(rester.checked ? fb.auth.Auth.Persistence.LOCAL : fb.auth.Auth.Persistence.SESSION)
          .then(function () { return A.cx.auth.createUserWithEmailAndPassword(EMAIL, v); })
          .then(function () { toast('Mot de passe créé'); })
          .catch(function (e) { bouton.disabled = false; m.textContent = msgAuth(e); });
      });
      ecran(el('div', { class: 'card login' }, [
        el('h2', { text: 'Créer le mot de passe de l\'admin ' + NOM }),
        el('p', { class: 'muted', text: 'À faire une seule fois, par la personne responsable. Ensuite, donnez ce mot de passe aux membres de l\'équipe ' + NOM.toLowerCase() + ' qui doivent voir les réponses.' }),
        form,
        el('p', { class: 'small', style: 'margin:18px 0 0' }, [el('button', { class: 'btn-link', type: 'button', text: '← Retour à la connexion', onclick: function () { ecranConnexion(); } })])
      ]));
    }

    /* =========================================================
       Données : écoute de la configuration et des réponses
       ========================================================= */
    function demarrer() {
      rendreTete();
      ecran(el('p', { class: 'chargement', text: 'Chargement des données…' }));
      A.stop.push(A.docRef.onSnapshot(function (snap) {
        var d = snap.exists ? snap.data() : null;
        var avant = A.doc;
        A.doc = d;
        if (!d) { A.brouillon = null; A.charge = true; rendreTete(); ecranInit(); return; }
        if (!A.brouillon || (d.brouillonSession !== A.session && !A.sale && !identiques(A.brouillon, d.brouillon || d.publie))) {
          var externe = !!A.brouillon;
          A.brouillon = canon(d.brouillon || d.publie);
          if (externe && A.onglet === 'questions') toast('Le brouillon a été modifié depuis un autre ordinateur : affichage mis à jour.');
          if (externe && A.onglet === 'questions') { rendreOnglets(); return rendrePanneau(true); }
        } else if (d.brouillonSession !== A.session && A.sale && avant && JSON.stringify(canon(avant.brouillon)) !== JSON.stringify(canon(d.brouillon))) {
          toast('Attention : le brouillon est aussi modifié depuis un autre ordinateur. Vos modifications l\'emporteront.');
        }
        A.charge = true;
        rendreTete();
        if (!barre || !barre.isConnected) return afficherTableau();
        rendreOnglets();
        if (A.onglet === 'ouverture' && !A.ouvSale) return rendrePanneau(true);
        if (A.onglet === 'ouverture' || A.onglet === 'reglages') return;   /* ne pas effacer une saisie en cours */
        if (A.onglet === 'questions') return majEtatBrouillon();
        rendreReponses(true);
      }, function (e) { ecranMessage('Accès impossible', esc(msgDonnees(e)), 'ko'); }));

      A.stop.push(A.repsRef.orderBy('cree', 'desc').onSnapshot(function (snap) {
        var liste = [];
        snap.forEach(function (doc) {
          var d = doc.data({ serverTimestamps: 'estimate' });
          liste.push({ id: doc.id, r: d.r || {}, lang: d.lang || 'fr', v: d.v, cree: versDate(d.cree) });
        });
        if (A.vus) liste.forEach(function (r) { if (!A.vus[r.id]) A.neufs[r.id] = Date.now(); });
        A.vus = {}; liste.forEach(function (r) { A.vus[r.id] = 1; });
        A.reponses = liste; A.repsChargees = true; A.erreurReps = null;
        if (!A.charge || !A.doc) return;
        rendreOnglets();
        if (A.onglet === 'reponses') rendreReponses(true);
        if (A.onglet === 'reglages') majBoutonsDonnees();
      }, function (e) {
        A.repsChargees = true; A.erreurReps = msgDonnees(e);
        if (A.charge && A.doc && A.onglet === 'reponses') rendreReponses(true);
      }));
    }

    /* =========================================================
       Création du formulaire pour l'événement
       ========================================================= */
    function ecranInit() {
      var f = A.fiche;
      var b = el('div', { class: 'card bloc' });
      b.appendChild(el('h2', { text: 'Créer le formulaire ' + NOM + ' pour ' + t(f.nom, 'fr') }));
      b.appendChild(el('p', { text: 'Il n\'existe pas encore pour cet événement. Il est créé fermé : vous pourrez relire les questions, voir l\'aperçu, puis l\'ouvrir aux participants (onglet « Ouverture & lien »).' }));
      var m = el('p', { class: 'msg ko', role: 'alert' });
      b.appendChild(el('div', { class: 'row', style: 'margin-top:12px' }, [
        el('button', { class: 'btn btn-o', type: 'button', text: 'Partir du modèle ' + NOM, onclick: function (ev) {
          ev.target.disabled = true;
          creer(opts.modele(f)).catch(function (e) { ev.target.disabled = false; m.textContent = msgDonnees(e); });
        } }),
        el('span', { class: 'small muted', text: 'Questions habituelles, dates reprises de la fiche.' })
      ]));
      var zoneAutres = el('div', { style: 'margin-top:18px' });
      b.appendChild(zoneAutres);
      b.appendChild(m);
      ecran(b);
      chargerAutres().then(function (autres) {
        if (!autres.length) return;
        zoneAutres.appendChild(blocReprise(autres, function (contenu) { return creer(contenu); }, m));
      });
    }
    function creer(contenu) {
      var fv = A.cx.fb.firestore.FieldValue;
      var c = canon(contenu);
      A.onglet = 'questions'; memoOnglet();
      var donnees = {
        outil: outil, evenement: A.fiche.id,
        brouillon: c, brouillonSession: A.session, brouillonMaj: fv.serverTimestamp(),
        publie: Object.assign(clone(c), { version: 1, publieLe: fv.serverTimestamp() }),
        ouverture: { ouvert: false, debut: '', fin: '', debutTs: null, finTs: null },
        cree: fv.serverTimestamp()
      };
      return A.cx.db.runTransaction(function (tx) {
        return tx.get(A.docRef).then(function (s) {
          if (s.exists) { var e = new Error('Le formulaire vient d\'être créé depuis un autre ordinateur.'); e.code = 'deja'; throw e; }
          tx.set(A.docRef, donnees);
        });
      }).then(function () {
        toast('Formulaire créé (fermé). Relisez les questions.');
        if (barre && barre.isConnected) { rendreOnglets(); rendrePanneau(); }
      }, function (e) { if (e && e.code === 'deja') { toast(e.message); return; } throw e; });
    }
    /* Autres événements qui ont déjà ce formulaire (pour reprendre leurs questions) */
    function chargerAutres() {
      if (A.autres) return Promise.resolve(A.autres);
      var ids = ((A.index && A.index.evenements) || []).map(function (e) { return e.id; }).filter(function (id) { return id !== A.fiche.id; });
      return Promise.all(ids.map(function (id) {
        return A.cx.db.doc(F.chemin(id, outil)).get().then(function (s) {
          if (!s.exists) return null;
          var d = s.data();
          return Fiche.charger(id).then(function (fi) { return { id: id, nom: t(fi.nom, 'fr'), debut: fi.debut, contenu: d.publie || d.brouillon }; }, function () { return { id: id, nom: id, debut: '', contenu: d.publie || d.brouillon }; });
        }).catch(function () { return null; });
      })).then(function (l) { A.autres = l.filter(Boolean); return A.autres; });
    }
    function blocReprise(autres, appliquer, m) {
      var sel = el('select', { id: 'reprise-evt' });
      autres.forEach(function (a) { sel.appendChild(el('option', { value: a.id, text: a.nom })); });
      var decaler = el('input', { type: 'checkbox', id: 'reprise-dec', checked: true });
      return el('div', { class: 'fld' }, [
        el('label', { for: 'reprise-evt', text: 'Ou reprendre les questions d\'un autre événement' }),
        el('div', { class: 'row' }, [sel, el('button', { class: 'btn btn-g', type: 'button', text: 'Reprendre ces questions', onclick: function (ev) {
          var a = autres.filter(function (x) { return x.id === sel.value; })[0];
          if (!a || !a.contenu) return;
          var c = canon(clone(a.contenu));
          var n = decaler.checked ? joursEntre(a.debut, A.fiche.debut) : 0;
          decalerContenu(c, n);
          ev.target.disabled = true;
          Promise.resolve(appliquer(c, n, a)).then(function () { ev.target.disabled = false; }, function (e) { ev.target.disabled = false; if (m) m.textContent = msgDonnees(e); });
        } })]),
        el('label', { class: 'chk' }, [decaler, el('span', { text: 'Décaler les dates des questions (jours autorisés, dates limites) de l\'écart entre les deux événements' })]),
        el('p', { class: 'aide', text: 'Les textes qui citent des dates ne sont pas modifiés : relisez-les.' })
      ]);
    }

    /* =========================================================
       Tableau de bord (onglets)
       ========================================================= */
    var ONGLETS = [['reponses', 'Réponses'], ['questions', 'Questions'], ['ouverture', 'Ouverture & lien'], ['reglages', 'Réglages']];
    var barre = null, panneau = null;
    function memoOnglet() { try { sessionStorage.setItem('form-onglet-' + outil, A.onglet); } catch (e) { /* rien */ } }
    function afficherTableau() {
      barre = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections de l\'admin' });
      panneau = el('div', { class: 'panel', role: 'tabpanel', id: 'panneau' });
      ecran([barre, panneau]);
      rendreOnglets();
      rendrePanneau();
    }
    function rendreOnglets() {
      if (!barre) return;
      barre.innerHTML = '';
      ONGLETS.forEach(function (o) {
        var puce = null;
        if (o[0] === 'reponses') puce = el('span', { class: 'puce', text: String(A.reponses.length) });
        if (o[0] === 'questions' && A.doc && A.brouillon && !identiques(A.brouillon, A.doc.publie)) puce = el('span', { class: 'puce alerte', text: '•', title: 'Modifications non publiées' });
        barre.appendChild(el('button', { type: 'button', role: 'tab', id: 'tab-' + o[0], 'aria-selected': String(A.onglet === o[0]), 'aria-controls': 'panneau', tabindex: A.onglet === o[0] ? '0' : '-1', onclick: function () {
          if (A.onglet === o[0]) return;
          A.onglet = o[0]; memoOnglet(); rendreOnglets(); rendrePanneau();
        } }, [o[1], puce]));
      });
      if (panneau) panneau.setAttribute('aria-labelledby', 'tab-' + A.onglet);
    }
    /* flèches gauche / droite entre les onglets */
    document.addEventListener('keydown', function (ev) {
      if (!barre || !barre.contains(ev.target) || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft' && ev.key !== 'Home' && ev.key !== 'End')) return;
      ev.preventDefault();
      var i = ONGLETS.map(function (o) { return o[0]; }).indexOf(A.onglet), n = ONGLETS.length;
      i = ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + n) % n;
      A.onglet = ONGLETS[i][0]; memoOnglet(); rendreOnglets(); rendrePanneau();
      document.getElementById('tab-' + A.onglet).focus();
    });
    function rendrePanneau(garderDefilement) {
      if (!panneau) return;
      var y = global.scrollY;
      panneau.innerHTML = '';
      if (A.onglet === 'questions') rendreQuestions();
      else if (A.onglet === 'ouverture') rendreOuverture();
      else if (A.onglet === 'reglages') rendreReglages();
      else rendreReponses();
      if (garderDefilement) global.scrollTo(0, y);
    }

    /* =========================================================
       Onglet Réponses
       ========================================================= */
    var zoneRep = null;
    function questionsAffichage() {
      /* colonnes : questions de la version en ligne (y compris masquées),
         puis celles du brouillon qui n'y sont pas encore */
      var pub = (A.doc && A.doc.publie && A.doc.publie.questions) || [];
      var ids = {}; pub.forEach(function (q) { ids[q.id] = 1; });
      var plus = ((A.brouillon && A.brouillon.questions) || []).filter(function (q) { return !ids[q.id]; });
      return pub.concat(plus);
    }
    function filtrer() {
      var txt = A.filtre.texte.trim().toLowerCase(), depuis = A.filtre.depuis;
      return A.reponses.filter(function (r) {
        if (depuis && r.cree && D.dateVersParis(r.cree).slice(0, 10) < depuis) return false;
        if (!txt) return true;
        return Object.keys(r.r).some(function (k) { var v = r.r[k]; return String(Array.isArray(v) ? v.join(' ') : v).toLowerCase().indexOf(txt) > -1; });
      });
    }
    function rendreReponses(majSeulement) {
      if (majSeulement && zoneRep && zoneRep.isConnected) return remplirReponses();
      var auj = aujourdhuiParis(), il7 = D.dateVersParis(new Date(Date.now() - 6 * 86400000)).slice(0, 10);
      var stats = el('div', { class: 'stats', id: 'stats' });
      panneau.appendChild(stats);
      var recherche = el('input', { type: 'search', id: 'rep-recherche', placeholder: 'Nom, e-mail, ville…', value: A.filtre.texte });
      var depuis = el('input', { type: 'date', id: 'rep-depuis', value: A.filtre.depuis });
      var exp = el('button', { class: 'btn btn-t', type: 'button', id: 'rep-export', onclick: function () { exporter(filtrer()); } });
      recherche.addEventListener('input', function () { A.filtre.texte = recherche.value; remplirReponses(); });
      depuis.addEventListener('change', function () { A.filtre.depuis = depuis.value; remplirReponses(); });
      panneau.appendChild(el('div', { class: 'card bloc' }, [
        el('div', { class: 'outils-rep' }, [
          champ('Rechercher', recherche),
          champ('Reçues depuis le', depuis, 'Pratique pour ne reporter dans KBS que les nouvelles.'),
          el('div', { class: 'fld' }, [el('span', { class: 'lbl', html: '&nbsp;' }), exp])
        ])
      ]));
      zoneRep = el('div', { class: 'panel' });
      panneau.appendChild(zoneRep);
      remplirReponses();
      function remplirStats() {
        stats.innerHTML = '';
        var nAuj = A.reponses.filter(function (r) { return r.cree && D.dateVersParis(r.cree).slice(0, 10) === auj; }).length;
        var n7 = A.reponses.filter(function (r) { return r.cree && D.dateVersParis(r.cree).slice(0, 10) >= il7; }).length;
        [[A.reponses.length, 'réponse' + (A.reponses.length > 1 ? 's' : '') + ' au total'], [nAuj, 'aujourd\'hui'], [n7, 'ces 7 derniers jours']].forEach(function (s) {
          stats.appendChild(el('div', { class: 'card stat' }, [el('b', { text: String(s[0]) }), el('span', { text: s[1] })]));
        });
        if (A.reponses[0] && A.reponses[0].cree) stats.appendChild(el('div', { class: 'card stat' }, [el('b', { text: D.horodatage(A.reponses[0].cree).slice(0, 5), style: 'font-size:20px' }), el('span', { text: 'dernière réponse, ' + D.horodatage(A.reponses[0].cree).slice(11) })]));
      }
      rendreReponses.stats = remplirStats;
      remplirStats();
    }
    function remplirReponses() {
      if (rendreReponses.stats) rendreReponses.stats();
      var liste = filtrer();
      var exp = document.getElementById('rep-export');
      if (exp) { exp.textContent = 'Exporter en CSV (' + liste.length + ')'; exp.disabled = !liste.length; }
      zoneRep.innerHTML = '';
      if (A.erreurReps) { zoneRep.appendChild(el('div', { class: 'note ko', text: A.erreurReps })); return; }
      if (!A.repsChargees) { zoneRep.appendChild(el('p', { class: 'chargement', text: 'Chargement des réponses…' })); return; }
      if (!A.reponses.length) {
        var e = D.etatOuverture(A.doc.ouverture);
        zoneRep.appendChild(el('div', { class: 'card vide' }, [el('p', { text: 'Aucune réponse pour l\'instant.' }), e.etat !== 'ouvert' ? el('p', { class: 'small', html: 'Le formulaire n\'est pas ouvert aux participants : voir l\'onglet <strong>Ouverture &amp; lien</strong>.' }) : null]));
        return;
      }
      var qs = questionsAffichage();
      var cols = F.colonnes(qs, A.reponses);
      /* synthèse */
      var synth = synthese(cols, liste);
      if (synth) zoneRep.appendChild(el('details', { class: 'card bloc dep', open: !!A.synthOuverte, ontoggle: function (ev) { A.synthOuverte = ev.target.open; } }, [el('summary', { text: 'Synthèse des réponses' + (liste.length !== A.reponses.length ? ' (' + liste.length + ' affichées)' : '') }), synth]));
      if (!liste.length) { zoneRep.appendChild(el('div', { class: 'card vide', text: 'Aucune réponse ne correspond à la recherche.' })); return; }
      /* doublons : même e-mail */
      var qMail = cols.filter(function (q) { return q.type === 'email'; })[0];
      var parMail = {};
      if (qMail) A.reponses.forEach(function (r) { var m = String(r.r[qMail.id] || '').trim().toLowerCase(); if (m) parMail[m] = (parMail[m] || 0) + 1; });
      var table = el('table', { class: 'tbl' });
      var trh = el('tr', null, [el('th', { scope: 'col', text: 'Reçue le' })]);
      cols.forEach(function (q) { trh.appendChild(el('th', { scope: 'col', class: q.masque ? 'masq' : '', title: t(q.label, 'fr') + (q.masque ? ' (question masquée)' : ''), text: (t(q.label, 'fr') || q.id).slice(0, 40) + (q.masque ? ' (masquée)' : '') })); });
      table.appendChild(el('thead', null, trh));
      var tb = el('tbody');
      liste.forEach(function (r) {
        var tr = el('tr', { class: A.neufs[r.id] && Date.now() - A.neufs[r.id] < 4000 ? 'neuf' : '', tabindex: '0', 'aria-label': 'Voir la réponse du ' + D.horodatage(r.cree) });
        tr.appendChild(el('td', { class: 'date', text: D.horodatage(r.cree) || '…' }));
        cols.forEach(function (q) {
          var v = r.r[q.id];
          var txt = v === undefined ? '' : F.lisible(q.inconnue ? null : q, v, 'fr');
          var td = el('td', { text: txt, title: txt.length > 30 ? txt : null });
          if (q === qMail && v && parMail[String(v).trim().toLowerCase()] > 1) td.appendChild(el('span', { class: 'doublon', title: 'Cette adresse a répondu plusieurs fois', text: '×' + parMail[String(v).trim().toLowerCase()] }));
          tr.appendChild(td);
        });
        var ouvrir = function () { detailReponse(r, cols); };
        tr.addEventListener('click', ouvrir);
        tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ouvrir(); } });
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      zoneRep.appendChild(el('div', { class: 'tbl-wrap' }, table));
      zoneRep.appendChild(el('p', { class: 'small muted', style: 'margin:0', text: 'Cliquez sur une ligne pour voir la réponse complète, la copier ou la supprimer.' }));
    }
    function synthese(cols, liste) {
      var blocs = [];
      cols.forEach(function (q) {
        if (q.inconnue || ['choix', 'liste', 'cases', 'case', 'jourheure'].indexOf(q.type) < 0) return;
        var compte = {}, ordre = [], total = 0;
        var plus = function (cle) { if (!(cle in compte)) { compte[cle] = 0; ordre.push(cle); } compte[cle]++; };
        if (OPTIONS_TYPES[q.type]) F.options(q).forEach(function (o) { var c = o.id === F.AUTRE_ID ? 'Autre' : o.fr; compte[c] = 0; ordre.push(c); });
        if (q.type === 'case') { compte.Oui = 0; compte.Non = 0; ordre = ['Oui', 'Non']; }
        liste.forEach(function (r) {
          var v = r.r[q.id];
          if (v === undefined || v === '') return;
          total++;
          if (q.type === 'case') plus(v === true ? 'Oui' : 'Non');
          else if (q.type === 'jourheure') plus(D.jourTexte(String(v).slice(0, 10)));
          else (Array.isArray(v) ? v : [v]).forEach(function (x) { plus(String(x).indexOf('Autre : ') === 0 || x === 'Autre' ? 'Autre' : String(x)); });
        });
        if (!total) return;
        var b = el('div', { class: 'synth-q' }, [el('h4', { text: t(q.label, 'fr') + ' (' + total + ')' })]);
        ordre.forEach(function (k) {
          var n = compte[k] || 0, pc = Math.round(n * 100 / total);
          if (!n && q.type === 'jourheure') return;
          b.appendChild(el('div', { class: 'barre' }, [el('span', { text: k }), el('b', { text: n + (n ? ' · ' + pc + ' %' : '') }), el('span', { class: 'jauge' }, el('i', { style: 'width:' + pc + '%' }))]));
        });
        blocs.push(b);
      });
      return blocs.length ? el('div', { class: 'synth' }, blocs) : null;
    }
    function texteReponse(r, cols) {
      var l = ['Réponse du ' + D.horodatage(r.cree) + ' (' + NOM + ')'];
      cols.forEach(function (q) { var v = r.r[q.id]; if (v !== undefined) l.push(t(q.label, 'fr') + ' : ' + F.lisible(q.inconnue ? null : q, v, 'fr')); });
      return l.join('\n');
    }
    function detailReponse(r, cols) {
      var dl = el('dl');
      cols.forEach(function (q) {
        var v = r.r[q.id];
        if (v === undefined && q.masque) return;
        dl.appendChild(el('dt', { class: q.masque ? 'masq' : '', text: t(q.label, 'fr') + (q.masque ? ' (masquée)' : '') }));
        dl.appendChild(el('dd', { text: v === undefined ? '—' : (F.lisible(q.inconnue ? null : q, v, 'fr') || '—') }));
      });
      dialogue({
        titre: 'Réponse du ' + (D.horodatage(r.cree) || '…'),
        corps: [el('div', { class: 'detail' }, dl), el('p', { class: 'small muted', style: 'margin:14px 0 0', text: 'Langue du formulaire : ' + (r.lang === 'en' ? 'anglais' : 'français') + ' · référence ' + r.id })],
        boutons: [
          { texte: 'Supprimer', classe: 'btn-danger', action: function () {
            return confirmer('Supprimer cette réponse ?', 'Elle sera effacée définitivement (par exemple un doublon ou un test).', 'Supprimer', true).then(function (ok) {
              if (!ok) return false;
              return A.repsRef.doc(r.id).delete().then(function () { toast('Réponse supprimée'); }, function (e) { toast(msgDonnees(e)); return false; });
            });
          } },
          { texte: 'Copier le texte', action: function () { copier(texteReponse(r, cols)); return false; } },
          { texte: 'Fermer', classe: 'btn-t' }
        ]
      });
    }
    function exporter(liste) {
      var qs = questionsAffichage();
      var nom = outil + '-' + A.fiche.id + '-' + D.dateVersParis(new Date()).slice(0, 16).replace('T', '-').replace(':', 'h') + '.csv';
      U.telecharger(nom, F.csv(qs, liste), 'text/csv;charset=utf-8');
    }

    /* =========================================================
       Onglet Questions (brouillon → aperçu → publication)
       ========================================================= */
    var zoneEtat = null, zoneListe = null;
    function nbReponses(id) { var n = 0; A.reponses.forEach(function (r) { if (r.r && id in r.r) n++; }); return n; }
    function planifierSauvegarde() {
      A.sale = true;
      majEtatBrouillon('Modifications en cours…');
      clearTimeout(A.minuterie);
      A.minuterie = setTimeout(sauvegarder, 900);
    }
    function sauvegarder() {
      clearTimeout(A.minuterie);
      if (!A.sale || !A.brouillon) return Promise.resolve();
      var copie = canon(A.brouillon);
      A.sale = false;
      majEtatBrouillon('Enregistrement…');
      return A.docRef.update({ brouillon: copie, brouillonSession: A.session, brouillonMaj: A.cx.fb.firestore.FieldValue.serverTimestamp() }).then(function () {
        majEtatBrouillon('Brouillon enregistré à ' + D.horodatage(new Date()).slice(11));
      }, function (e) {
        A.sale = true;
        majEtatBrouillon('Échec de l\'enregistrement (' + (F.codeErreur(e) || 'erreur') + ') — nouvel essai dans 5 s');
        A.minuterie = setTimeout(sauvegarder, 5000);
      });
    }
    function majEtatBrouillon(texteSauve) {
      if (texteSauve != null) A.etatSauve = texteSauve;
      rendreOnglets();
      if (!zoneEtat || !zoneEtat.isConnected) return;
      var diff = A.doc && !identiques(A.brouillon, A.doc.publie);
      zoneEtat.className = 'card etat-brouillon' + (diff ? ' modif' : '');
      zoneEtat.innerHTML = '';
      zoneEtat.appendChild(el('div', null, [
        el('span', { class: 'txt', text: diff ? 'Modifications non publiées : les participants voient encore l\'ancienne version.' : 'Le brouillon est identique à la version en ligne.' }),
        el('span', { class: 'sauve', 'aria-live': 'polite', text: A.etatSauve || '' })
      ]));
      zoneEtat.appendChild(el('div', { class: 'row' }, [
        diff ? el('button', { class: 'btn-link', type: 'button', text: 'Annuler les modifications', onclick: annulerModifs }) : null,
        el('button', { class: 'btn btn-g', type: 'button', text: 'Aperçu', onclick: apercu }),
        el('button', { class: 'btn btn-o', type: 'button', text: 'Publier', disabled: !diff, onclick: publier })
      ]));
    }
    function rendreQuestions() {
      zoneEtat = el('div', { class: 'card etat-brouillon' });
      panneau.appendChild(zoneEtat);
      majEtatBrouillon();
      panneau.appendChild(blocTextes());
      var bq = el('div', { class: 'card bloc' });
      bq.appendChild(el('h2', { text: 'Questions' }));
      bq.appendChild(el('p', { html: 'Cliquez sur une question pour la modifier. Chaque modification est gardée dans le brouillon : <strong>rien ne change pour les participants avant « Publier »</strong>. Une question qui a déjà des réponses est masquée, jamais supprimée.' }));
      zoneListe = el('div', { class: 'qlist' });
      bq.appendChild(zoneListe);
      bq.appendChild(blocAjout());
      panneau.appendChild(bq);
      rendreListe();
      panneau.appendChild(blocOutilsQuestions());
    }
    function champBil(titre, obj, cle, multi, aide, apres) {
      var mk = function (lang) {
        var i = el(multi ? 'textarea' : 'input', multi ? { rows: '3' } : { type: 'text' });
        var cur = obj[cle];
        i.value = cur && typeof cur === 'object' ? (cur[lang] || '') : (lang === 'fr' && typeof cur === 'string' ? cur : '');
        i.setAttribute('lang', lang);
        i.addEventListener('input', function () {
          if (!obj[cle] || typeof obj[cle] !== 'object') obj[cle] = { fr: typeof obj[cle] === 'string' ? obj[cle] : '' };
          obj[cle][lang] = i.value; planifierSauvegarde(); if (apres) apres();
        });
        var id = U.uid('b'); i.id = id;
        return el('div', { class: 'fld' }, [el('label', { for: id, html: '<span class="tag-lang">' + lang.toUpperCase() + '</span>' + esc(titre) }), i]);
      };
      var g = el('div', { class: 'bil' }, [mk('fr'), mk('en')]);
      return aide ? el('div', null, [g, el('p', { class: 'aide', style: 'margin:4px 0 0', html: aide })]) : g;
    }
    function blocTextes() {
      var B = A.brouillon;
      var d = el('details', { class: 'card bloc dep', open: !!A.textesOuverts, ontoggle: function (ev) { A.textesOuverts = ev.target.open; } });
      d.appendChild(el('summary', { text: 'Textes du formulaire (titre, introduction, messages, données personnelles)' }));
      var corps = el('div', { class: 'panel', style: 'margin-top:12px;gap:14px' });
      corps.appendChild(champBil('Titre', B, 'titre', false));
      corps.appendChild(champBil('Introduction (en haut du formulaire)', B, 'intro', true, 'Mise en forme : **gras** ; les liens https://… et les adresses e-mail deviennent cliquables.'));
      corps.appendChild(champBil('Message affiché après l\'envoi', B, 'merci', true));
      corps.appendChild(champBil('Message quand le formulaire est fermé', B, 'ferme', true));
      corps.appendChild(champBil('Mention sur les données personnelles (RGPD), en bas du formulaire', B, 'rgpd', true));
      var contact = el('input', { type: 'email', value: B.contact || '', spellcheck: 'false' });
      contact.addEventListener('input', function () { B.contact = contact.value.trim(); planifierSauvegarde(); });
      corps.appendChild(champ('Adresse de contact affichée aux participants', contact, 'Adresse de service (ex. benevolat-festival@kadampafrance.org) : la page est publique.'));
      d.appendChild(corps);
      return d;
    }
    function resumeCondition(q) {
      var c = q.condition; if (!c || !c.q) return '';
      var src = null; (A.brouillon.questions || []).forEach(function (x) { if (x.id === c.q) src = x; });
      if (!src) return 'condition cassée';
      var o = null; F.options(src).forEach(function (x) { if (x.id === c.o) o = x; });
      var lib = t(src.label, 'fr') || '?';
      if (lib.length > 48) lib = lib.slice(0, 46).replace(/\s+\S*$/, '') + '…';
      return 'si « ' + lib + ' » ' + (F.OPERATEURS[c.op] || '') + (o ? ' « ' + t(o, 'fr') + ' »' : '');
    }
    function rendreListe(focusId) {
      zoneListe.innerHTML = '';
      var qs = A.brouillon.questions || [];
      if (!qs.length) zoneListe.appendChild(el('p', { class: 'vide', text: 'Aucune question. Ajoutez-en une ci-dessous.' }));
      var num = 0;
      qs.forEach(function (q, i) { if (q.type !== 'section') num++; zoneListe.appendChild(carte(q, i, q.type === 'section' ? '§' : String(num))); });
      if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); if (f.select) f.select(); } }
    }
    function carte(q, i, numero) {
      var qs = A.brouillon.questions;
      var ouvert = !!A.ouverts[q.id];
      var n = nbReponses(q.id);
      var c = el('div', { class: 'qc' + (q.masque ? ' masquee' : '') + (q.type === 'section' ? ' sec' : ''), id: 'qc-' + q.id });
      var infos = el('small');
      var majInfos = function () {
        infos.innerHTML = '';
        [[F.TYPES[q.type] ? F.TYPES[q.type].nom : q.type, ''], [q.requis && q.type !== 'section' ? 'Obligatoire' : '', 'b-req'], [q.masque ? 'Masquée' : '', 'b-masq'], [q.condition && q.condition.q ? resumeCondition(q) : '', 'b-cond'], [n ? n + ' réponse' + (n > 1 ? 's' : '') : '', '']].forEach(function (x) {
          if (x[0]) infos.appendChild(el('span', { class: x[1], text: x[0] }));
        });
      };
      majInfos();
      var libelle = el('b', { text: t(q.label, 'fr') || '(sans intitulé)' });
      var titre = el('button', { class: 'qc-titre', type: 'button', 'aria-expanded': String(ouvert), 'aria-controls': 'qb-' + q.id, onclick: function () { A.ouverts[q.id] = !ouvert; rendreListe(); var cc = document.querySelector('#qc-' + q.id + ' .qc-titre'); if (cc) cc.focus(); } }, [libelle, infos]);
      var bouton = function (ico, label, action, desactive) { return el('button', { class: 'ic', type: 'button', title: label, 'aria-label': label + ' : ' + (t(q.label, 'fr') || 'question ' + (i + 1)), html: ico, disabled: !!desactive, onclick: action }); };
      var actions = el('div', { class: 'qc-act' }, [
        bouton(ICO.haut, 'Monter', function () { deplacer(i, -1); }, i === 0),
        bouton(ICO.bas, 'Descendre', function () { deplacer(i, 1); }, i === qs.length - 1),
        bouton(ICO.copie, 'Dupliquer', function () { dupliquer(i); }),
        bouton(q.masque ? ICO.oeilBarre : ICO.oeil, q.masque ? 'Afficher de nouveau' : 'Masquer', function () { q.masque = !q.masque; if (!q.masque) delete q.masque; planifierSauvegarde(); rendreListe(); }),
        bouton(ICO.corbeille, 'Supprimer', function () { supprimer(i); })
      ]);
      c.appendChild(el('div', { class: 'qc-head' }, [el('span', { class: 'qc-num', text: numero, 'aria-hidden': 'true' }), titre, actions]));
      if (ouvert) c.appendChild(corpsQuestion(q, i, function () { libelle.textContent = t(q.label, 'fr') || '(sans intitulé)'; majInfos(); }));
      return c;
    }
    function deplacer(i, d) {
      var qs = A.brouillon.questions, j = i + d;
      if (j < 0 || j >= qs.length) return;
      var q = qs[i]; qs[i] = qs[j]; qs[j] = q;
      planifierSauvegarde(); rendreListe();
      var b = document.querySelector('#qc-' + q.id + ' .qc-act button[title="' + (d < 0 ? 'Monter' : 'Descendre') + '"]');
      if (b && !b.disabled) b.focus(); else { var tt = document.querySelector('#qc-' + q.id + ' .qc-titre'); if (tt) tt.focus(); }
    }
    function dupliquer(i) {
      var qs = A.brouillon.questions, q = clone(qs[i]);
      q.id = U.uid('q');
      if (q.label) { q.label.fr = (q.label.fr || '') + ' (copie)'; if (q.label.en) q.label.en += ' (copy)'; }
      (q.options || []).forEach(function (o) { o.id = U.uid('o'); });
      if (q.condition && q.condition.q) { /* on garde la condition (elle porte sur une question placée avant) */ }
      qs.splice(i + 1, 0, q);
      A.ouverts[q.id] = true;
      planifierSauvegarde(); rendreListe('lbl-fr-' + q.id);
    }
    function supprimer(i) {
      var qs = A.brouillon.questions, q = qs[i], n = nbReponses(q.id);
      var dependantes = qs.filter(function (x) { return x.condition && x.condition.q === q.id; });
      if (n) {
        if (q.masque) { toast('Cette question a des réponses : elle reste masquée pour les garder.'); return; }
        confirmer('Masquer cette question ?', 'Elle a déjà <strong>' + n + ' réponse' + (n > 1 ? 's' : '') + '</strong> : elle ne sera plus proposée aux participants, mais elle reste dans l\'admin avec ses réponses (colonne « masquée »).', 'Masquer').then(function (ok) {
          if (!ok) return;
          q.masque = true; planifierSauvegarde(); rendreListe();
        });
        return;
      }
      confirmer('Supprimer cette question ?', esc(nomQ(q, i)) + (dependantes.length ? '<br><br>' + dependantes.length + ' question(s) s\'affichaient selon sa réponse : elles s\'afficheront toujours.' : ''), 'Supprimer', true).then(function (ok) {
        if (!ok) return;
        dependantes.forEach(function (x) { delete x.condition; });
        qs.splice(qs.indexOf(q), 1);
        delete A.ouverts[q.id];
        planifierSauvegarde(); rendreListe();
      });
    }
    function blocAjout() {
      var menu = el('div', { class: 'menu-types', hidden: true, id: 'menu-types' });
      Object.keys(F.TYPES).forEach(function (ty) {
        menu.appendChild(el('button', { type: 'button', 'data-type': ty, onclick: function () { ajouter(ty); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } }, [el('b', { text: F.TYPES[ty].nom }), el('span', { text: F.TYPES[ty].desc })]));
      });
      var btn = el('button', { class: 'btn btn-t', type: 'button', text: '+ Ajouter une question', 'aria-expanded': 'false', 'aria-controls': 'menu-types', onclick: function () { menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); } });
      return el('div', { style: 'margin-top:12px' }, [el('div', { class: 'ajout-q' }, [btn, el('span', { class: 'small muted', text: 'Choisissez le type : la question est ajoutée à la fin.' })]), menu]);
    }
    function nouvelleQuestion(ty) {
      var q = { id: U.uid('q'), type: ty, label: { fr: '', en: '' } };
      if (ty !== 'section' && ty !== 'case') q.requis = false;
      if (F.TYPES[ty].options) q.options = [{ id: U.uid('o'), fr: '', en: '' }, { id: U.uid('o'), fr: '', en: '' }];
      if (ty === 'jourheure') {
        var d = D.dateValide(A.fiche.debut) ? A.fiche.debut : '';
        q.jours = [{ date: d, de: '09:00', a: '21:00' }];
      }
      return q;
    }
    function ajouter(ty) {
      var q = nouvelleQuestion(ty);
      A.brouillon.questions = A.brouillon.questions || [];
      A.brouillon.questions.push(q);
      A.ouverts[q.id] = true;
      planifierSauvegarde(); rendreListe('lbl-fr-' + q.id);
      var c = document.getElementById('qc-' + q.id); if (c) c.scrollIntoView({ block: 'center' });
    }

    /* --- corps d'une question (formulaire d'édition) --- */
    function corpsQuestion(q, i, majTete) {
      var qs = A.brouillon.questions;
      var b = el('div', { class: 'qc-body', id: 'qb-' + q.id });
      var sec = q.type === 'section';
      /* type + obligatoire */
      var selType = el('select', { id: 'type-' + q.id });
      Object.keys(F.TYPES).forEach(function (ty) { selType.appendChild(el('option', { value: ty, text: F.TYPES[ty].nom, selected: ty === q.type })); });
      selType.addEventListener('change', function () {
        var nouveau = selType.value, n = nbReponses(q.id);
        var faire = function () {
          q.type = nouveau;
          if (F.TYPES[nouveau].options && !(q.options && q.options.length)) q.options = [{ id: U.uid('o'), fr: '', en: '' }];
          if (!F.TYPES[nouveau].options) { delete q.options; delete q.autre; }
          if (nouveau === 'jourheure' && !(q.jours && q.jours.length)) q.jours = [{ date: D.dateValide(A.fiche.debut) ? A.fiche.debut : '', de: '09:00', a: '21:00' }];
          if (nouveau !== 'jourheure') delete q.jours;
          if (!F.TYPES[nouveau].bornes) { delete q.min; delete q.max; }
          if (nouveau === 'section') { delete q.requis; delete q.condition; }
          qs.forEach(function (x) { if (x.condition && x.condition.q === q.id && !conditionPossible(q, x.condition.op)) delete x.condition; });
          planifierSauvegarde(); rendreListe('type-' + q.id);
        };
        if (n) confirmer('Changer le type ?', 'Cette question a déjà ' + n + ' réponse(s). Changer le type peut rendre ces réponses difficiles à lire. En général, il vaut mieux masquer cette question et en créer une nouvelle.', 'Changer quand même').then(function (ok) { if (ok) faire(); else selType.value = q.type; });
        else faire();
      });
      var ligne1 = el('div', { class: 'grid2' }, [champ('Type', selType)]);
      if (!sec) {
        var req = el('input', { type: 'checkbox', id: 'req-' + q.id, checked: !!q.requis });
        req.addEventListener('change', function () { q.requis = req.checked; planifierSauvegarde(); majTete(); });
        ligne1.appendChild(el('div', { class: 'fld' }, [el('span', { class: 'lbl', html: '&nbsp;' }), el('label', { class: 'chk' }, [req, el('span', { text: q.type === 'case' ? 'Obligatoire (la case doit être cochée)' : 'Réponse obligatoire' })])]));
      }
      b.appendChild(ligne1);
      /* intitulé et aide */
      var bil = champBil(sec ? 'Titre' : q.type === 'case' ? 'Texte à côté de la case' : 'Intitulé de la question', q, 'label', false, null, majTete);
      bil.querySelectorAll('input')[0].id = 'lbl-fr-' + q.id;
      bil.querySelectorAll('label')[0].setAttribute('for', 'lbl-fr-' + q.id);
      b.appendChild(bil);
      b.appendChild(champBil(sec ? 'Texte (facultatif)' : 'Texte d\'aide (facultatif, sous l\'intitulé)', q, 'aide', true));

      /* réponses possibles */
      if (F.TYPES[q.type].options) b.appendChild(editeurOptions(q));
      if (q.type === 'jourheure') b.appendChild(editeurJours(q));
      var bo = F.TYPES[q.type].bornes;
      if (bo) {
        var mk = function (cle, lib) {
          var i2 = el('input', { type: bo === 'date' ? 'date' : bo === 'heure' ? 'time' : 'number', value: q[cle] == null ? '' : q[cle] });
          if (bo === 'nombre') i2.step = 'any';
          i2.addEventListener('change', function () { if (i2.value === '') delete q[cle]; else q[cle] = i2.value; planifierSauvegarde(); });
          return champ(lib, i2);
        };
        var lib = q.type === 'cases' ? ['Nombre minimum de cases cochées', 'Nombre maximum de cases cochées'] : bo === 'date' ? ['Date au plus tôt', 'Date au plus tard'] : bo === 'heure' ? ['Heure au plus tôt', 'Heure au plus tard'] : ['Minimum', 'Maximum'];
        b.appendChild(el('h4', { text: 'Limites (facultatif)' }));
        b.appendChild(el('div', { class: 'grid2' }, [mk('min', lib[0]), mk('max', lib[1])]));
      }
      /* condition d'affichage */
      b.appendChild(editeurCondition(q, i, majTete));
      b.appendChild(el('p', { class: 'small muted', style: 'margin:0', text: 'Identifiant technique : ' + q.id + ' (il relie les réponses à la question, il ne change jamais).' }));
      return b;
    }
    function editeurOptions(q) {
      var box = el('div');
      box.appendChild(el('h4', { text: 'Réponses possibles' }));
      var liste = el('div', { class: 'panel', style: 'gap:6px' });
      box.appendChild(liste);
      var os = q.options = q.options || [];
      var dessiner = function (focus) {
        liste.innerHTML = '';
        liste.appendChild(el('div', { class: 'optrow small muted', 'aria-hidden': 'true' }, [el('span', { text: 'Français' }), el('span', { text: 'Anglais' }), el('span')]));
        os.forEach(function (o, k) {
          var fr = el('input', { type: 'text', value: o.fr || '', id: 'opt-' + o.id, 'aria-label': 'Réponse ' + (k + 1) + ' en français', placeholder: 'Réponse ' + (k + 1) });
          var en = el('input', { type: 'text', value: o.en || '', lang: 'en', 'aria-label': 'Réponse ' + (k + 1) + ' en anglais', placeholder: 'Answer ' + (k + 1) });
          var avantFr = o.fr || '';
          fr.addEventListener('input', function () { o.fr = fr.value; planifierSauvegarde(); });
          fr.addEventListener('change', function () {
            if (avantFr && avantFr !== o.fr && A.reponses.some(function (r) { var v = r.r[q.id]; return Array.isArray(v) ? v.indexOf(avantFr) > -1 : v === avantFr; })) toast('Les réponses déjà reçues gardent l\'ancien libellé « ' + avantFr + ' ».');
            avantFr = o.fr;
          });
          en.addEventListener('input', function () { o.en = en.value; planifierSauvegarde(); });
          var act = el('div', { class: 'row', style: 'gap:0;flex-wrap:nowrap' }, [
            el('button', { class: 'ic', type: 'button', title: 'Monter', 'aria-label': 'Monter la réponse ' + (k + 1), html: ICO.haut, disabled: k === 0, onclick: function () { var x = os[k]; os[k] = os[k - 1]; os[k - 1] = x; planifierSauvegarde(); dessiner(); } }),
            el('button', { class: 'ic', type: 'button', title: 'Retirer', 'aria-label': 'Retirer la réponse ' + (k + 1), html: ICO.x, onclick: function () {
              var dep = A.brouillon.questions.filter(function (x) { return x.condition && x.condition.o === o.id; });
              if (dep.length) { toast('Cette réponse est utilisée dans une condition d\'affichage : modifiez d\'abord la condition.'); return; }
              os.splice(k, 1); planifierSauvegarde(); dessiner();
            } })
          ]);
          liste.appendChild(el('div', { class: 'optrow' }, [fr, en, act]));
        });
        if (focus) { var f = document.getElementById(focus); if (f) f.focus(); }
      };
      dessiner();
      var autre = el('input', { type: 'checkbox', checked: !!q.autre });
      autre.addEventListener('change', function () { if (autre.checked) q.autre = true; else delete q.autre; planifierSauvegarde(); });
      box.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('button', { class: 'btn btn-g btn-sm', type: 'button', text: '+ Ajouter une réponse', onclick: function () { var o = { id: U.uid('o'), fr: '', en: '' }; os.push(o); planifierSauvegarde(); dessiner('opt-' + o.id); } }),
        el('label', { class: 'chk' }, [autre, el('span', { text: 'Ajouter une réponse « Autre » avec un champ libre' })])
      ]));
      return box;
    }
    function editeurJours(q) {
      var box = el('div');
      box.appendChild(el('h4', { text: 'Jours autorisés et heures possibles' }));
      box.appendChild(el('p', { class: 'aide', style: 'margin:0 0 6px', text: 'Chaque jour proposé a ses heures (de… à…). Laissez une heure vide pour ne pas limiter.' }));
      var liste = el('div', { class: 'panel', style: 'gap:8px' });
      box.appendChild(liste);
      var js = q.jours = q.jours || [];
      var dessiner = function () {
        liste.innerHTML = '';
        js.forEach(function (j, k) {
          var d = el('input', { type: 'date', value: j.date || '' });
          var nomJour = el('span', { class: 'aide', text: D.dateValide(j.date) ? D.jourTexte(j.date) : '' });
          var de = el('input', { type: 'time', value: j.de || '', step: '60' });
          var a = el('input', { type: 'time', value: j.a || '', step: '60' });
          d.addEventListener('change', function () { j.date = d.value; nomJour.textContent = D.dateValide(j.date) ? D.jourTexte(j.date) : ''; planifierSauvegarde(); });
          de.addEventListener('change', function () { j.de = de.value; planifierSauvegarde(); });
          a.addEventListener('change', function () { j.a = a.value; planifierSauvegarde(); });
          liste.appendChild(el('div', { class: 'jrow' }, [
            el('div', { class: 'fld' }, [el('label', { text: 'Jour ' + (k + 1) }), d, nomJour]),
            el('div', { class: 'fld' }, [el('label', { text: 'À partir de' }), de]),
            el('div', { class: 'fld' }, [el('label', { text: 'Jusqu\'à' }), a]),
            el('button', { class: 'ic', type: 'button', title: 'Retirer ce jour', 'aria-label': 'Retirer le jour ' + (k + 1), html: ICO.x, onclick: function () { js.splice(k, 1); planifierSauvegarde(); dessiner(); } })
          ]));
          /* libellés accessibles */
          Array.prototype.forEach.call(liste.lastChild.querySelectorAll('.fld'), function (f) { var i2 = f.querySelector('input'), l = f.querySelector('label'); i2.id = U.uid('j'); l.setAttribute('for', i2.id); });
        });
      };
      dessiner();
      box.appendChild(el('button', { class: 'btn btn-g btn-sm', type: 'button', style: 'margin-top:8px', text: '+ Ajouter un jour', onclick: function () {
        var dernier = js.length ? js[js.length - 1] : null;
        var date = dernier && D.dateValide(dernier.date) ? D.decalerJour(dernier.date, 1) : (D.dateValide(A.fiche.debut) ? A.fiche.debut : '');
        js.push({ date: date, de: dernier ? dernier.de : '09:00', a: dernier ? dernier.a : '21:00' });
        planifierSauvegarde(); dessiner();
      } }));
      return box;
    }
    function conditionPossible(src, op) {
      if (op === 'coche' || op === 'pasCoche') return src.type === 'case';
      if (op === 'egal' || op === 'different') return !!F.TYPES[src.type].options;
      return true;
    }
    function editeurCondition(q, i, majTete) {
      var box = el('div');
      box.appendChild(el('h4', { text: 'Affichage' }));
      var avant = A.brouillon.questions.slice(0, i).filter(function (x) { return F.TYPES[x.type] && F.TYPES[x.type].reponse; });
      var c = q.condition;
      var mode = el('select', { id: 'cond-' + q.id });
      mode.appendChild(el('option', { value: '', text: 'Toujours afficher', selected: !c }));
      mode.appendChild(el('option', { value: 'si', text: 'Afficher seulement si…', selected: !!c, disabled: !avant.length }));
      var detail = el('div', { class: 'grid3', style: 'margin-top:8px' });
      var dessiner = function () {
        detail.innerHTML = '';
        c = q.condition;
        if (!c) return;
        var src = null; avant.forEach(function (x) { if (x.id === c.q) src = x; });
        var selQ = el('select');
        avant.forEach(function (x) { selQ.appendChild(el('option', { value: x.id, text: (t(x.label, 'fr') || '(sans intitulé)').slice(0, 60), selected: src === x })); });
        if (!src) { selQ.insertBefore(el('option', { value: '', text: '— question introuvable —', selected: true }), selQ.firstChild); }
        var ops = Object.keys(F.OPERATEURS).filter(function (op) { return src ? conditionPossible(src, op) : true; });
        var selOp = el('select');
        ops.forEach(function (op) { selOp.appendChild(el('option', { value: op, text: F.OPERATEURS[op], selected: op === c.op })); });
        detail.appendChild(champ('La question', selQ));
        detail.appendChild(champ('Condition', selOp));
        if (src && (c.op === 'egal' || c.op === 'different')) {
          var selO = el('select');
          F.options(src).forEach(function (o) { selO.appendChild(el('option', { value: o.id, text: t(o, 'fr') || '(vide)', selected: o.id === c.o })); });
          if (!c.o) c.o = selO.value;
          selO.addEventListener('change', function () { c.o = selO.value; planifierSauvegarde(); majTete(); });
          detail.appendChild(champ('la réponse', selO));
        }
        selQ.addEventListener('change', function () {
          var s = null; avant.forEach(function (x) { if (x.id === selQ.value) s = x; });
          c.q = selQ.value; c.op = s ? defautOp(s) : 'rempli'; delete c.o;
          if (s && (c.op === 'egal') && F.options(s)[0]) c.o = F.options(s)[0].id;
          planifierSauvegarde(); dessiner(); majTete();
        });
        selOp.addEventListener('change', function () {
          c.op = selOp.value;
          if ((c.op === 'egal' || c.op === 'different') && src && !c.o && F.options(src)[0]) c.o = F.options(src)[0].id;
          if (c.op !== 'egal' && c.op !== 'different') delete c.o;
          planifierSauvegarde(); dessiner(); majTete();
        });
      };
      var defautOp = function (s) { return s.type === 'case' ? 'pasCoche' : F.TYPES[s.type].options ? 'egal' : 'rempli'; };
      mode.addEventListener('change', function () {
        if (mode.value === 'si' && avant.length) {
          var s = avant[avant.length - 1];
          q.condition = { q: s.id, op: defautOp(s) };
          if (q.condition.op === 'egal' && F.options(s)[0]) q.condition.o = F.options(s)[0].id;
        } else delete q.condition;
        planifierSauvegarde(); dessiner(); majTete();
      });
      box.appendChild(champ('Quand afficher cette ' + (q.type === 'section' ? 'partie' : 'question') + ' ?', mode, avant.length ? null : 'Une condition ne peut porter que sur une question placée avant.'));
      box.appendChild(detail);
      dessiner();
      return box;
    }

    function blocOutilsQuestions() {
      var d = el('details', { class: 'card bloc dep' });
      d.appendChild(el('summary', { text: 'Autres actions (modèle, reprise, sauvegarde)' }));
      var corps = el('div', { class: 'panel', style: 'margin-top:12px' });
      var m = el('p', { class: 'msg ko', role: 'alert' });
      corps.appendChild(el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-g', type: 'button', text: 'Revenir au modèle ' + NOM, onclick: function () {
          confirmer('Revenir au modèle ?', 'Le brouillon est remplacé par les questions du modèle (dates reprises de la fiche). La version en ligne ne change pas avant « Publier ». Les questions qui ont déjà des réponses sont gardées, masquées.', 'Remplacer le brouillon').then(function (ok) {
            if (ok) remplacerBrouillon(opts.modele(A.fiche));
          });
        } }),
        el('button', { class: 'btn btn-g', type: 'button', text: 'Exporter les questions (.json)', onclick: function () { U.telecharger(outil + '-questions-' + A.fiche.id + '.json', JSON.stringify({ outil: outil, evenement: A.fiche.id, exporte: new Date().toISOString(), brouillon: canon(A.brouillon), publie: canon(A.doc.publie) }, null, 2), 'application/json'); } }),
        el('button', { class: 'btn btn-g', type: 'button', text: 'Importer des questions (.json)', onclick: function () { fichier.click(); } })
      ]));
      var fichier = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: function (ev) {
        var fi = ev.target.files[0]; ev.target.value = '';
        if (!fi) return;
        m.textContent = '';
        fi.text().then(function (txt) {
          var o = JSON.parse(txt), c = o.brouillon || o.publie || o;
          if (!c || !Array.isArray(c.questions)) throw new Error('fichier sans questions');
          if (o.outil && o.outil !== outil) throw new Error('ce fichier vient de l\'outil « ' + o.outil + ' »');
          var bil = function (x) { return typeof x === 'string' ? { fr: x } : x && typeof x === 'object' ? { fr: String(x.fr || ''), en: String(x.en || '') } : undefined; };
          ['titre', 'intro', 'merci', 'ferme', 'rgpd'].forEach(function (k) { if (c[k] != null) c[k] = bil(c[k]); });
          c.questions.forEach(function (q) {
            if (!q || !F.TYPES[q.type] || !F.RE_ID.test(String(q.id || ''))) throw new Error('question invalide (' + (q && q.id || '?') + ')');
            q.label = bil(q.label) || { fr: '' }; if (q.aide != null) q.aide = bil(q.aide);
            (q.options || []).forEach(function (op) { op.fr = String(op.fr || ''); if (op.en != null) op.en = String(op.en); if (!op.id) op.id = U.uid('o'); });
          });
          return confirmer('Importer ces questions ?', c.questions.length + ' question(s). Le brouillon est remplacé ; la version en ligne ne change pas avant « Publier ».', 'Importer').then(function (ok) { if (ok) remplacerBrouillon(c); });
        }).catch(function (e) { m.textContent = 'Import impossible : ' + e.message; });
      } });
      corps.appendChild(fichier);
      var zoneR = el('div');
      corps.appendChild(zoneR);
      corps.appendChild(m);
      chargerAutres().then(function (autres) {
        if (autres.length) zoneR.appendChild(blocReprise(autres, function (c) {
          return confirmer('Reprendre ces questions ?', 'Le brouillon est remplacé par les questions de l\'autre événement. La version en ligne ne change pas avant « Publier ».', 'Remplacer le brouillon').then(function (ok) { if (ok) remplacerBrouillon(c); });
        }, m));
      });
      d.appendChild(corps);
      return d;
    }
    /* Remplace le brouillon en gardant, masquées, les questions qui ont des réponses */
    function remplacerBrouillon(c) {
      var nouveau = canon(clone(c));
      var ids = {}; (nouveau.questions || []).forEach(function (q) { ids[q.id] = 1; });
      questionsAffichage().forEach(function (q) {
        if (!ids[q.id] && nbReponses(q.id)) { var x = clone(q); x.masque = true; delete x.condition; nouveau.questions.push(x); }
      });
      A.brouillon = nouveau; A.ouverts = {};
      planifierSauvegarde(); rendrePanneau();
      toast('Brouillon remplacé. Relisez, puis « Publier ».');
    }
    function annulerModifs() {
      confirmer('Annuler les modifications ?', 'Le brouillon revient à la version en ligne. Les modifications non publiées sont perdues.', 'Annuler les modifications', true).then(function (ok) {
        if (!ok) return;
        A.brouillon = canon(A.doc.publie); planifierSauvegarde(); rendrePanneau();
      });
    }
    function apercu() {
      var lang = 'fr', etat = {};
      var zone = el('div', { class: 'pub' });
      var dessiner = function () {
        zone.innerHTML = '';
        zone.appendChild(el('div', { class: 'pub-top' }, el('div', { class: 'lang', role: 'group', 'aria-label': 'Langue de l\'aperçu' }, ['fr', 'en'].map(function (l) {
          return el('button', { type: 'button', text: l.toUpperCase(), 'aria-pressed': String(lang === l), onclick: function () { lang = l; dessiner(); } });
        }))));
        var o = A.doc.ouverture || {};
        zone.appendChild(F.entete(A.fiche, lang, t(A.brouillon.titre, lang), o.fin && D.dateHeureValide(o.fin) ? F.msg(lang, 'jusquau', { d: D.dateHeureTexte(o.fin, lang) }) : ''));
        var z = el('main'); zone.appendChild(z);
        F.rendreFormulaire(z, clone(A.brouillon), { lang: lang, apercu: true, etat: etat, contact: A.brouillon.contact });
      };
      var dlg = dialogue({ titre: 'Aperçu du brouillon (rien n\'est envoyé)', classe: 'apercu', corps: [el('div', { class: 'apercu-bandeau', text: 'Aperçu : c\'est ce que verront les participants après « Publier ». Vous pouvez tester les réponses et les messages d\'erreur.' }), zone] });
      F.appliquerCharte(A.fiche);
      dessiner();
      void dlg;
    }
    function differences() {
      var p = (A.doc.publie && A.doc.publie.questions) || [], b = A.brouillon.questions || [];
      var pm = {}, bm = {}; p.forEach(function (q) { pm[q.id] = q; }); b.forEach(function (q) { bm[q.id] = q; });
      var l = [];
      b.forEach(function (q, i) {
        if (!pm[q.id]) l.push('Ajoutée : ' + nomQ(q, i));
        else if (q.masque && !pm[q.id].masque) l.push('Masquée : ' + nomQ(q, i));
        else if (!q.masque && pm[q.id].masque) l.push('Affichée de nouveau : ' + nomQ(q, i));
        else if (JSON.stringify(q) !== JSON.stringify(pm[q.id])) l.push('Modifiée : ' + nomQ(q, i));
      });
      p.forEach(function (q, i) { if (!bm[q.id]) l.push('Supprimée : ' + nomQ(q, i)); });
      if (JSON.stringify(p.map(function (q) { return q.id; }).filter(function (id) { return bm[id]; })) !== JSON.stringify(b.map(function (q) { return q.id; }).filter(function (id) { return pm[id]; }))) l.push('Ordre des questions modifié');
      ['titre', 'intro', 'merci', 'ferme', 'rgpd', 'contact'].forEach(function (k) {
        if (JSON.stringify(A.brouillon[k] || null) !== JSON.stringify((A.doc.publie || {})[k] || null)) l.push('Texte modifié : ' + { titre: 'titre', intro: 'introduction', merci: 'message après l\'envoi', ferme: 'message de fermeture', rgpd: 'mention RGPD', contact: 'adresse de contact' }[k]);
      });
      return l;
    }
    function publier() {
      var v = F.verifierContenu(A.brouillon);
      var corps = [];
      var liste = function (items, cls) {
        return el('ul', { class: 'liste-err' }, items.map(function (x) {
          var li = el('li', { class: cls });
          if (x.q) li.appendChild(el('button', { class: 'btn-link', type: 'button', text: x.texte, onclick: function () { if (dlg.open) dlg.close(); A.ouverts[x.q] = true; rendreListe(); var c = document.getElementById('qc-' + x.q); if (c) c.scrollIntoView({ block: 'center' }); } }));
          else li.textContent = x.texte;
          return li;
        }));
      };
      var dlg;
      if (v.erreurs.length) {
        corps.push(el('div', { class: 'note ko' }, [el('p', { html: '<strong>Impossible de publier : ' + v.erreurs.length + ' point(s) à corriger.</strong>' }), liste(v.erreurs, 'e')]));
        if (v.avertissements.length) corps.push(el('div', { class: 'note warn', style: 'margin-top:10px' }, [el('p', { text: 'À vérifier aussi :' }), liste(v.avertissements, 'w')]));
        dlg = dialogue({ titre: 'Publier', corps: corps, boutons: [{ texte: 'Fermer', classe: 'btn-t' }] });
        return;
      }
      var diffs = differences();
      corps.push(el('p', { text: 'Les participants verront la nouvelle version dès la publication (les réponses déjà reçues ne changent pas).' }));
      if (diffs.length) corps.push(el('div', { class: 'note' }, [el('p', { html: '<strong>Changements</strong>' }), el('ul', null, diffs.map(function (d) { return el('li', { text: d }); }))]));
      if (v.avertissements.length) corps.push(el('div', { class: 'note warn', style: 'margin-top:10px' }, [el('p', { text: 'À vérifier (n\'empêche pas de publier) :' }), liste(v.avertissements, 'w')]));
      dlg = dialogue({
        titre: 'Publier la nouvelle version', corps: corps,
        boutons: [
          { texte: 'Voir l\'aperçu', action: function () { setTimeout(apercu, 0); } },
          { texte: 'Annuler' },
          { texte: 'Publier maintenant', classe: 'btn-o', action: function (d, bt) {
            bt.disabled = true;
            return faireLaPublication().then(function () { toast('Publié : les participants voient la nouvelle version.'); }, function (e) { bt.disabled = false; toast(msgDonnees(e)); return false; });
          } }
        ]
      });
    }
    function faireLaPublication() {
      clearTimeout(A.minuterie);
      /* filet de sécurité : une question retirée qui a des réponses est gardée, masquée */
      A.brouillon.questions = A.brouillon.questions || [];
      var ids = {}; A.brouillon.questions.forEach(function (q) { ids[q.id] = 1; });
      ((A.doc.publie && A.doc.publie.questions) || []).forEach(function (q) {
        if (!ids[q.id] && nbReponses(q.id)) { var x = clone(q); x.masque = true; delete x.condition; A.brouillon.questions.push(x); }
      });
      var c = canon(A.brouillon), fv = A.cx.fb.firestore.FieldValue;
      var version = ((A.doc.publie && A.doc.publie.version) || 0) + 1;
      var etaitSale = A.sale;
      A.sale = false;
      return A.docRef.update({
        publie: Object.assign(clone(c), { version: version, publieLe: fv.serverTimestamp() }),
        brouillon: c, brouillonSession: A.session, brouillonMaj: fv.serverTimestamp()
      }).then(function () { A.etatSauve = 'Version ' + version + ' publiée à ' + D.horodatage(new Date()).slice(11); rendrePanneau(true); },
        function (e) { if (etaitSale) planifierSauvegarde(); throw e; });
    }

    /* =========================================================
       Onglet Ouverture & lien
       ========================================================= */
    function rendreOuverture() {
      var o = clone(A.doc.ouverture || {}), e = D.etatOuverture(o);
      var b = el('div', { class: 'card bloc' });
      b.appendChild(el('h2', { text: 'Ouverture aux participants' }));
      var phrases = {
        ouvert: 'Le formulaire est <strong>ouvert</strong> : il reçoit des réponses' + (e.fin ? ' jusqu\'au ' + esc(D.dateHeureTexte(e.fin)) + '.' : '.'),
        ferme: 'Le formulaire est <strong>fermé</strong> : les participants voient le message de fermeture.',
        bientot: 'Le formulaire <strong>ouvrira automatiquement</strong> le ' + esc(D.dateHeureTexte(e.date || '')) + '.',
        termine: 'Le formulaire est <strong>fermé automatiquement</strong> depuis le ' + esc(D.dateHeureTexte(e.date || '')) + ' (date limite).'
      };
      b.appendChild(el('div', { class: 'note ' + (e.etat === 'ouvert' ? 'ok' : e.etat === 'bientot' ? 'warn' : ''), html: phrases[e.etat] }));
      var ouvert = el('input', { type: 'checkbox', id: 'ouv-ouvert', checked: !!o.ouvert });
      var debut = el('input', { type: 'datetime-local', id: 'ouv-debut', value: o.debut || '' });
      var fin = el('input', { type: 'datetime-local', id: 'ouv-fin', value: o.fin || '' });
      var m = el('p', { class: 'msg', role: 'status' });
      var bouton = el('button', { class: 'btn btn-t', type: 'button', text: 'Enregistrer', disabled: true });
      A.ouvSale = false;
      var modif = function () { bouton.disabled = false; m.textContent = ''; A.ouvSale = true; };
      [ouvert, debut, fin].forEach(function (x) { x.addEventListener('change', modif); x.addEventListener('input', modif); });
      b.appendChild(el('label', { class: 'chk', style: 'margin:14px 0 6px;font-weight:700' }, [ouvert, el('span', { text: 'Formulaire ouvert aux réponses' })]));
      b.appendChild(el('div', { class: 'grid2' }, [
        champ('Ouverture automatique (facultatif)', debut, 'Avant cette date, le formulaire annonce sa date d\'ouverture.'),
        champ('Fermeture automatique (facultatif)', fin, 'Exemple : la date limite de réservation des navettes. Heure de Paris.')
      ]));
      if (A.doc && !identiques(A.brouillon, A.doc.publie)) b.appendChild(el('div', { class: 'note warn', style: 'margin-top:12px', html: 'Des modifications de questions ne sont pas encore publiées (onglet <strong>Questions</strong>).' }));
      b.appendChild(el('div', { class: 'row', style: 'margin-top:14px' }, [bouton, m]));
      bouton.addEventListener('click', function () {
        if (debut.value && !D.dateHeureValide(debut.value)) { m.className = 'msg ko'; m.textContent = 'Date d\'ouverture invalide.'; return; }
        if (fin.value && !D.dateHeureValide(fin.value)) { m.className = 'msg ko'; m.textContent = 'Date de fermeture invalide.'; return; }
        if (debut.value && fin.value && debut.value >= fin.value) { m.className = 'msg ko'; m.textContent = 'La fermeture doit être après l\'ouverture.'; return; }
        var Ts = A.cx.fb.firestore.Timestamp;
        var n = {
          ouvert: ouvert.checked, debut: debut.value || '', fin: fin.value || '',
          debutTs: debut.value ? Ts.fromDate(D.parisVersDate(debut.value)) : null,
          finTs: fin.value ? Ts.fromDate(D.parisVersDate(fin.value)) : null
        };
        bouton.disabled = true;
        A.docRef.update({ ouverture: n }).then(function () {
          A.doc.ouverture = n; A.ouvSale = false;
          toast('Ouverture enregistrée');
          rendreTete(); rendrePanneau(true);
        }, function (err) { bouton.disabled = false; m.className = 'msg ko'; m.textContent = msgDonnees(err); });
      });
      panneau.appendChild(b);

      /* lien et QR code */
      var l = el('div', { class: 'card bloc' });
      l.appendChild(el('h2', { text: 'Lien à diffuser' }));
      l.appendChild(el('p', { html: 'Ce lien ne change pas : il peut aller dans les <strong>lettres KBS</strong>, sur le site et dans les e-mails. Dans une lettre, mettez-le derrière un texte (ex. « Réserver ma navette »), jamais l\'adresse brute.' }));
      [['fr', 'Français'], ['en', 'Anglais']].forEach(function (x) {
        var u = lienPublic(x[0]);
        l.appendChild(el('div', { class: 'fld', style: 'margin-top:10px' }, [el('span', { class: 'lbl', text: x[1] + (x[0] === 'en' ? ' (ouvre directement la version anglaise)' : ' (s\'adapte à la langue du navigateur)') }),
          el('div', { class: 'lien-pub' }, [el('code', { text: u }), el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Copier', onclick: function () { copier(u); } }), el('a', { class: 'btn btn-g btn-sm', href: u, target: '_blank', rel: 'noopener', text: 'Ouvrir ↗' })])]));
      });
      if (typeof global.qrcode === 'function') {
        var u0 = lienPublic('fr');
        var q = global.qrcode(0, 'M'); q.addData(u0); q.make();
        var nq = q.getModuleCount(), chemin = '';
        for (var r = 0; r < nq; r++) for (var cc = 0; cc < nq; cc++) if (q.isDark(r, cc)) chemin += 'M' + cc + ' ' + r + 'h1v1h-1z';
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + nq + ' ' + nq + '" shape-rendering="crispEdges" role="img" aria-label="QR code du formulaire"><rect width="' + nq + '" height="' + nq + '" fill="#fff"/><path d="' + chemin + '" fill="#000"/></svg>';
        l.appendChild(el('div', { class: 'row', style: 'margin-top:14px;align-items:flex-start' }, [
          el('div', { class: 'qr', html: svg }),
          el('div', { class: 'fld' }, [el('p', { class: 'aide', text: 'QR code du lien (affiches, diapos d\'accueil).' }), el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Télécharger le QR code (PNG)', onclick: function () {
            var calme = 4, tot = nq + calme * 2, ech = Math.max(1, Math.floor(1200 / tot)), px = tot * ech;
            var cv = document.createElement('canvas'); cv.width = cv.height = px;
            var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.fillStyle = '#000';
            for (var r2 = 0; r2 < nq; r2++) for (var c2 = 0; c2 < nq; c2++) if (q.isDark(r2, c2)) g.fillRect((c2 + calme) * ech, (r2 + calme) * ech, ech, ech);
            cv.toBlob(function (bl) { U.telecharger('qr-' + outil + '-' + A.fiche.id + '.png', bl); }, 'image/png');
          } })])
        ]));
      }
      panneau.appendChild(l);
    }

    /* =========================================================
       Onglet Réglages
       ========================================================= */
    function rendreReglages() {
      var fb = A.cx.fb;
      /* mot de passe */
      var b = el('div', { class: 'card bloc' });
      b.appendChild(el('h2', { text: 'Mot de passe de l\'admin ' + NOM }));
      b.appendChild(el('p', { text: 'Il est commun à toute l\'équipe ' + NOM.toLowerCase() + ' et sert pour tous les événements. Après un changement, donnez le nouveau mot de passe aux personnes concernées.' }));
      var actuel = el('input', { type: 'password', autocomplete: 'current-password', id: 'mdp-actuel' });
      var nouveau = el('input', { type: 'text', autocomplete: 'new-password', spellcheck: 'false', id: 'mdp-nouveau', style: 'font-family:ui-monospace,Consolas,monospace' });
      var m = el('p', { class: 'msg', role: 'status' });
      var bt = el('button', { class: 'btn btn-t', type: 'button', text: 'Changer le mot de passe' });
      b.appendChild(el('div', { class: 'grid2' }, [champ('Mot de passe actuel', actuel), champ('Nouveau mot de passe (10 caractères au moins)', nouveau)]));
      b.appendChild(el('div', { class: 'row', style: 'margin-top:12px' }, [
        el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Générer', onclick: function () { nouveau.value = genererMotDePasse(); nouveau.select(); } }),
        bt, m
      ]));
      bt.addEventListener('click', function () {
        var u = A.cx.auth.currentUser, nv = nouveau.value;
        m.className = 'msg ko';
        if (!actuel.value) { m.textContent = 'Entrez le mot de passe actuel.'; return; }
        if (nv.length < 10) { m.textContent = 'Le nouveau mot de passe doit faire au moins 10 caractères.'; return; }
        if (nv !== nv.trim()) { m.textContent = 'Le mot de passe ne doit pas commencer ni finir par une espace.'; return; }
        bt.disabled = true; m.textContent = '';
        u.reauthenticateWithCredential(fb.auth.EmailAuthProvider.credential(EMAIL, actuel.value))
          .then(function () { return u.updatePassword(nv); })
          .then(function () { bt.disabled = false; actuel.value = ''; m.className = 'msg ok'; m.textContent = 'Mot de passe changé. Notez-le : il ne peut pas être retrouvé.'; })
          .catch(function (e) { bt.disabled = false; m.textContent = F.codeErreur(e) === 'auth/invalid-credential' || F.codeErreur(e) === 'auth/wrong-password' ? 'Mot de passe actuel incorrect.' : msgAuth(e); });
      });
      panneau.appendChild(b);

      /* données personnelles */
      var r = el('div', { class: 'card bloc' });
      r.appendChild(el('h2', { text: 'Données personnelles (RGPD)' }));
      r.appendChild(el('p', { html: 'Les réponses ne servent qu\'à l\'organisation de l\'événement. <strong>Après l\'événement</strong>, une fois les informations reportées dans KBS, supprimez-les. Exportez d\'abord en CSV si vous devez garder une trace.' }));
      r.appendChild(el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-g', type: 'button', id: 'btn-export-tout', onclick: function () { exporter(A.reponses); } }),
        el('button', { class: 'btn btn-danger', type: 'button', id: 'btn-purge', onclick: purger })
      ]));
      panneau.appendChild(r);
      majBoutonsDonnees();

      /* compte technique */
      panneau.appendChild(el('div', { class: 'card bloc' }, [
        el('h2', { text: 'Compte technique' }),
        el('p', { html: 'Dans Firebase, le mot de passe est rattaché au compte <code>' + esc(EMAIL) + '</code> (aucun e-mail n\'y est envoyé). ' +
          'En cas d\'oubli : console Firebase → Authentication → Utilisateurs → supprimer ce compte, réactiver un instant la création de comptes, puis « Première utilisation » sur cette page (procédure complète dans le guide). Les questions et les réponses ne sont pas touchées. Détails : <a href="https://github.com/kmcfrance/kmcfrance.github.io/blob/main/commun/FORMULAIRES.md" target="_blank" rel="noopener">FORMULAIRES.md</a>.' }),
        el('p', { class: 'small muted', text: 'Projet Firebase : ' + ((A.fiche.formulaires && A.fiche.formulaires.firebase && A.fiche.formulaires.firebase.projectId) || '?') + ' · données : ' + F.chemin(A.fiche.id, outil) })
      ]));
    }
    function majBoutonsDonnees() {
      var e = document.getElementById('btn-export-tout'), p = document.getElementById('btn-purge'), n = A.reponses.length;
      if (e) { e.textContent = 'Exporter toutes les réponses (CSV)'; e.disabled = !n; }
      if (p) { p.textContent = 'Supprimer toutes les réponses (' + n + ')'; p.disabled = !n; }
    }
    function purger() {
      var saisie = el('input', { type: 'text', id: 'purge-ok', autocomplete: 'off' });
      /* on supprime exactement les réponses annoncées (pas celles arrivées entre-temps) */
      var cibles = A.reponses.slice(), n = cibles.length;
      dialogue({
        titre: 'Supprimer toutes les réponses ?',
        corps: [el('p', { html: '<strong>' + n + ' réponse' + (n > 1 ? 's' : '') + '</strong> du formulaire ' + esc(NOM) + ' pour ' + esc(t(A.fiche.nom, 'fr')) + ' seront effacées définitivement. Les questions sont gardées.' }), champ('Pour confirmer, tapez SUPPRIMER', saisie)],
        boutons: [
          { texte: 'Exporter d\'abord (CSV)', action: function () { exporter(cibles); return false; } },
          { texte: 'Annuler' },
          { texte: 'Supprimer définitivement', classe: 'btn-danger', action: function (dlg, bt) {
            if (saisie.value.trim().toUpperCase() !== 'SUPPRIMER') { saisie.focus(); toast('Tapez SUPPRIMER pour confirmer.'); return false; }
            bt.disabled = true;
            var ids = cibles.map(function (x) { return x.id; }), lots = [];
            for (var i = 0; i < ids.length; i += 400) lots.push(ids.slice(i, i + 400));
            return lots.reduce(function (p, lot) {
              return p.then(function () { var bat = A.cx.db.batch(); lot.forEach(function (id) { bat.delete(A.repsRef.doc(id)); }); return bat.commit(); });
            }, Promise.resolve()).then(function () { toast(n + ' réponse' + (n > 1 ? 's' : '') + ' supprimée' + (n > 1 ? 's' : '') + '.'); rendrePanneau(); }, function (e) { bt.disabled = false; toast(msgDonnees(e)); return false; });
          } }
        ]
      });
    }
  };
})(window);
