/* =========================================================
   Page « Lettres KBS » (/lettres/?evt=<id>)
   Textes des lettres : /evenements/<id>/lettres.json, enregistré sur GitHub
   avec le même jeton que la page « Préparer ».
   ========================================================= */
(function () {
  'use strict';
  var L = window.Lettres, F = window.Formulaires, U = F.util, el = U.el, esc = U.esc;
  var API = 'https://api.github.com';
  /* Dépôt = celui du site affiché (site d'essai → son propre dépôt), sinon kmcfrance. */
  var DEPOT = (function () {
    var m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
    return m ? { owner: m[1], repo: location.hostname.toLowerCase(), branch: 'main' } : { owner: 'kmcfrance', repo: 'kmcfrance.github.io', branch: 'main' };
  })();
  var CLE_GH = 'preparer-github', CLE_GH_JETON = 'preparer-github-jeton';   /* partagés avec « Préparer » */
  var LANGS = [['fr', 'FR'], ['en', 'EN']], VERSIONS = [['presentiel', 'Présentiel'], ['streaming', 'Streaming']];

  var S = {
    fiche: null, index: null, data: null, base: null, sha: null, source: '',
    lettre: 0, version: 'presentiel', lang: 'fr', onglet: 'lettres',
    gh: { token: '', souvenir: false }, sale: false
  };
  var racine = document.getElementById('app');

  /* ---------- stockage et GitHub ---------- */
  var Stock = {
    get: function (s, k) { try { return window[s].getItem(k); } catch (e) { return null; } },
    set: function (s, k, v) { try { window[s].setItem(k, v); return true; } catch (e) { return false; } },
    del: function (s, k) { try { window[s].removeItem(k); } catch (e) { /* rien */ } }
  };
  function lireGH() {
    try { var o = JSON.parse(Stock.get('localStorage', CLE_GH) || '{}'); ['owner', 'repo', 'branch'].forEach(function (k) { if (o[k]) DEPOT[k] = o[k]; }); S.gh.souvenir = !!o.souvenir; if (o.souvenir && o.token) S.gh.token = o.token; } catch (e) { /* rien */ }
    if (!S.gh.token) S.gh.token = Stock.get('sessionStorage', CLE_GH_JETON) || '';
  }
  function sauverGH() {
    var o = {}; try { o = JSON.parse(Stock.get('localStorage', CLE_GH) || '{}'); } catch (e) { /* rien */ }
    o.owner = DEPOT.owner; o.repo = DEPOT.repo; o.branch = DEPOT.branch; o.souvenir = S.gh.souvenir;
    if (S.gh.souvenir && S.gh.token) o.token = S.gh.token; else delete o.token;
    Stock.set('localStorage', CLE_GH, JSON.stringify(o));
    if (S.gh.token && !S.gh.souvenir) Stock.set('sessionStorage', CLE_GH_JETON, S.gh.token); else Stock.del('sessionStorage', CLE_GH_JETON);
  }
  function gh(methode, chemin, corps) {
    var h = { Authorization: 'Bearer ' + S.gh.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (corps) h['Content-Type'] = 'application/json';
    return fetch(API + chemin, { method: methode, headers: h, body: corps ? JSON.stringify(corps) : undefined, cache: 'no-store' }).then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* rien */ }
        if (!r.ok) { var e2 = new Error(messageGH(r.status, d)); e2.status = r.status; throw e2; }
        return d;
      });
    }, function () { var e3 = new Error('Impossible de joindre GitHub. Vérifiez la connexion Internet.'); e3.status = 0; throw e3; });
  }
  function messageGH(st, d) {
    if (st === 401) return 'Jeton GitHub refusé (expiré ou mal copié). Ouvrez « Connexion GitHub ».';
    if (st === 403) return 'Ce jeton n\'a pas le droit d\'écrire dans le dépôt (permission « Contents : Read and write »).';
    if (st === 404) return 'Dépôt ou fichier introuvable.';
    if (st === 409) return 'Conflit : le fichier a changé entre-temps. Rechargez la page.';
    if (st === 422) return 'GitHub a refusé l\'enregistrement : ' + ((d && d.message) || '');
    return 'Erreur GitHub ' + st + (d && d.message ? ' : ' + d.message : '');
  }
  function depot() { return '/repos/' + encodeURIComponent(DEPOT.owner) + '/' + encodeURIComponent(DEPOT.repo); }
  function chemin(id) { return 'evenements/' + id + '/lettres.json'; }
  function b64(s) { var u = new TextEncoder().encode(s), b = ''; for (var i = 0; i < u.length; i++) b += String.fromCharCode(u[i]); return btoa(b); }
  function deb64(b) { var s = atob(String(b).replace(/\s/g, '')), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder('utf-8').decode(u); }
  /* Lit lettres.json : via GitHub si connecté (version à jour), sinon sur le site. null si absent. */
  function lireLettres(id) {
    if (S.gh.token) {
      return gh('GET', depot() + '/contents/' + chemin(id) + '?ref=' + encodeURIComponent(DEPOT.branch)).then(function (c) {
        return { data: JSON.parse(deb64(c.content)), sha: c.sha, source: 'github' };
      }, function () { return lireSite(id); });   /* 404 ou autre : on tente le site */
    }
    return lireSite(id);
  }
  function lireSite(id) {
    return fetch(Fiche.BASE + '/' + chemin(id), { cache: 'no-cache' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Lecture impossible (' + r.status + ')');
      return r.json().then(function (d) { return { data: d, sha: null, source: 'site' }; });
    });
  }

  /* ---------- brouillon local (modifications pas encore enregistrées) ---------- */
  function cleBrouillon() { return 'lettres-brouillon-' + S.fiche.id; }
  function memoriser() {
    S.sale = JSON.stringify(S.data) !== JSON.stringify(S.base);
    if (S.sale) Stock.set('localStorage', cleBrouillon(), JSON.stringify({ data: S.data, sha: S.sha, origine: origine(), quand: Date.now() }));
    else Stock.del('localStorage', cleBrouillon());
    majEtat();
  }
  /* frappe en cours pas encore mémorisée (minuterie de l'éditeur) */
  var enAttente = null;
  function vider() { if (enAttente) { var f = enAttente; enAttente = null; f(); } }
  window.addEventListener('pagehide', vider);
  window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') vider(); });
  window.addEventListener('beforeunload', function (e) { vider(); if (S.sale) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- petites aides ---------- */
  var toastN = null;
  function toast(t) {
    if (toastN) toastN.remove();
    toastN = el('div', { class: 'toast', role: 'status', text: t }); document.body.appendChild(toastN);
    var n = toastN; setTimeout(function () { n.remove(); }, Math.max(2600, t.length * 55));
  }
  function dialogue(o) {
    var id = U.uid('d'), dlg = el('dialog', { class: o.classe || '', 'aria-labelledby': id });
    var fermer = function () { if (dlg.open) dlg.close(); };
    dlg.appendChild(el('div', { class: 'dlg-head' }, [el('h2', { id: id, text: o.titre }), el('button', { class: 'x', type: 'button', 'aria-label': 'Fermer', html: '&times;', onclick: fermer })]));
    var c = el('div', { class: 'dlg-body' }); (Array.isArray(o.corps) ? o.corps : [o.corps]).forEach(function (x) { if (x) c.appendChild(typeof x === 'string' ? el('p', { text: x }) : x); });
    dlg.appendChild(c);
    if (o.boutons) {
      var p = el('div', { class: 'dlg-foot' });
      o.boutons.forEach(function (b) {
        var bt = el('button', { class: 'btn ' + (b.classe || 'btn-g'), type: 'button', text: b.texte });
        bt.addEventListener('click', function () { Promise.resolve(b.action ? b.action(dlg, bt) : undefined).then(function (v) { if (v !== false) fermer(); }); });
        p.appendChild(bt);
      });
      dlg.appendChild(p);
    }
    dlg.addEventListener('close', function () { dlg.remove(); if (o.apres) o.apres(); });
    document.body.appendChild(dlg); dlg.showModal();
    return dlg;
  }
  function confirmer(titre, texte, libelle, danger) {
    return new Promise(function (ok) {
      var r = false;
      dialogue({ titre: titre, corps: texte, boutons: [{ texte: 'Annuler' }, { texte: libelle, classe: danger ? 'btn-danger' : 'btn-t', action: function () { r = true; } }], apres: function () { ok(r); } });
    });
  }
  function pareil(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function normal(d) { d = JSON.parse(JSON.stringify(d)); normaliser(d); return d; }
  /* version dont partent les modifications en cours (pour détecter qu'une autre a été enregistrée entre-temps) */
  function origine() { return S.origine || S.base; }
  function lettre() { return S.data.lettres[S.lettre]; }
  function valeurs() { return L.valeurs(S.fiche, S.data.valeurs); }
  function titreLettre(l) { return (l.num ? l.num + ' · ' : '') + L.t(l.nom, 'fr'); }
  function nomFichier(l, v, lang) { return L.nomFichier(S.fiche.code, l, v, lang); }
  function preparer(l, v, lang) { return L.preparer((l.textes[v] || {})[lang] || '', L.gabarit(l, v), lang, valeurs(), S.fiche); }
  function telechargerDocx(l, v, lang) {
    var p = preparer(l, v, lang), nom = nomFichier(l, v, lang);
    U.telecharger(nom, new Blob([L.docx(p.paras, L.gabarit(l, v), nom)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    return p;
  }
  function aRelire(l, v) { return !!(l.aRelire && l.aRelire[v]); }
  function nomVersion(v, lang) { return (v === 'streaming' ? 'streaming' : 'présentiel') + ' ' + lang.toUpperCase(); }
  /* Une lettre avec des erreurs ne part pas : on explique, et « Télécharger quand même » reste possible */
  function demanderDocx(l, v, lang, allerA) {
    var p = preparer(l, v, lang), n = p.verif.erreurs.length;
    if (!n) {
      telechargerDocx(l, v, lang);
      if (aRelire(l, v)) toast('Téléchargée. Cette version est marquée « À relire » : relisez-la avant de la charger dans KBS.');
      return;
    }
    var ul = el('ul', { style: 'margin:8px 0 0;padding-left:20px' });
    p.verif.erreurs.slice(0, 8).forEach(function (x) { ul.appendChild(el('li', { text: (x.n ? 'Ligne ' + x.n + ' : ' : '') + x.texte })); });
    if (n > 8) ul.appendChild(el('li', { class: 'muted', text: '… et ' + (n - 8) + ' autre(s).' }));
    dialogue({
      titre: 'Lettre pas prête pour KBS',
      corps: [el('div', { class: 'note ko' }, [el('strong', { text: titreLettre(l) + ' (' + nomVersion(v, lang) + ') : ' + n + ' point' + (n > 1 ? 's' : '') + ' à corriger avant de la charger dans KBS.' }), ul]),
        el('p', { class: 'small muted', style: 'margin-top:10px', text: 'Le fichier téléchargé quand même contiendrait ces erreurs. Utile seulement pour un essai ou une relecture.' })],
      boutons: [{ texte: 'Télécharger quand même', classe: 'btn-g', action: function () { telechargerDocx(l, v, lang); toast('Téléchargée avec ' + n + ' erreur(s) : ne pas la charger dans KBS telle quelle.'); } },
        { texte: 'Corriger', classe: 'btn-t', action: function () { if (allerA) setTimeout(allerA, 0); } }]
    });
  }

  /* =========================================================
     Squelette
     ========================================================= */
  var tete = el('header', { class: 'adm-head' }), bandeau = el('div'), main = el('main', { class: 'panel' });
  racine.appendChild(el('div', { id: 'annonce', class: 'lecteur', 'aria-live': 'polite', role: 'status' }));
  racine.appendChild(el('div', { class: 'adm' }, [tete, bandeau, main,
    el('footer', { class: 'adm-foot' }, [el('span', { html: 'Mode d\'emploi : bouton « Aide » de l\'éditeur · <a href="/">Hub des outils</a>' }), el('span', { text: L.VERSION })])]));
  function rendreTete() {
    tete.innerHTML = '';
    var f = S.fiche;
    tete.appendChild(el('div', null, [
      el('p', { class: 'adm-kicker', text: 'Outils · lettres automatiques' }),
      el('h1', { text: 'Lettres KBS' }),
      el('p', { class: 'adm-evt', html: f ? '<strong>' + esc(L.t(f.nom, 'fr')) + '</strong> · ' + esc(f.datesTexte ? f.datesTexte.fr : '') +
        ' · <span title="' + esc(typeAide(f)) + '">type : ' + esc(L.TYPES[L.typeFiche(f)]) + (f.typeDeduit ? ' (d\'après le nom)' : '') + '</span>' : 'Chargement…' })
    ]));
    var d = el('div', { class: 'adm-side' });
    if (S.index && (S.index.evenements || []).length > 1 && f) {
      var sel = el('select', { class: 'btn btn-g btn-sm', 'aria-label': 'Événement' });
      S.index.evenements.forEach(function (e) { sel.appendChild(el('option', { value: e.id, text: e.nom, selected: e.id === f.id })); });
      sel.addEventListener('change', function () {
        if (S.sale && !window.confirm('Des modifications ne sont pas enregistrées sur GitHub. Elles restent gardées sur cet ordinateur. Changer d\'événement ?')) { sel.value = f.id; return; }
        location.search = '?evt=' + encodeURIComponent(sel.value);
      });
      d.appendChild(sel);
    }
    d.appendChild(el('button', { class: 'btn btn-g btn-sm', type: 'button', id: 'btn-gh', text: S.gh.token ? 'GitHub : connecté' : 'Connexion GitHub', onclick: connexionGH }));
    tete.appendChild(d);
  }
  function typeAide(f) {
    var ty = L.typeFiche(f);
    return (ty === 'festival' ? 'Festival : « Célébration » est signalé comme une erreur.' : ty === 'celebration' ? 'Célébration : « Festival » et « festivaliers » sont signalés comme des erreurs.' : 'Ni Célébration ni Festival : seul le mélange des deux termes est signalé.') +
      ' Le type se règle dans la page Préparer (section Général)' + (f.typeDeduit ? ' ; pour l\'instant, il est déduit du nom.' : '.');
  }
  function majEtat() {
    bandeau.innerHTML = '';
    if (!S.data) return;
    if (S.avis) bandeau.appendChild(el('div', { class: 'note warn', role: 'status', style: 'margin-bottom:12px', text: 'À vérifier : ' + S.avis }));
    var b = el('div', { class: 'card etat-l' + (S.sale ? ' modif' : ''), style: 'margin-bottom:16px' });
    b.appendChild(el('span', { html: S.sale ? '<strong>Modifications non enregistrées sur GitHub</strong> (gardées sur cet ordinateur).' : (S.sha || S.source === 'site' ? 'Lettres enregistrées sur GitHub : <code>' + esc(chemin(S.fiche.id)) + '</code>' : 'Nouvelles lettres, pas encore enregistrées.') }));
    var r = el('div', { class: 'row' });
    if (S.sale) r.appendChild(el('button', { class: 'btn-link', type: 'button', text: 'Annuler mes modifications', onclick: function () {
      confirmer('Annuler les modifications ?', 'Les lettres reviennent à la version enregistrée sur GitHub.', 'Annuler les modifications', true).then(function (ok) {
        if (!ok) return; S.data = JSON.parse(JSON.stringify(S.base)); S.origine = null; S.avis = ''; memoriser(); rendre();
      });
    } }));
    r.appendChild(el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Télécharger lettres.json', title: 'Sauvegarde, ou dépôt à la main sur GitHub', onclick: function () {
      U.telecharger('lettres.json', JSON.stringify(S.data, null, 2) + '\n', 'application/json');
    } }));
    r.appendChild(el('button', { class: 'btn btn-o', type: 'button', id: 'btn-enr', text: 'Enregistrer sur GitHub', disabled: !S.sale, onclick: enregistrer }));
    b.appendChild(r);
    bandeau.appendChild(b);
  }

  /* =========================================================
     Chargement
     ========================================================= */
  lireGH();
  rendreTete();
  main.appendChild(el('p', { class: 'chargement', text: 'Chargement…' }));
  Fiche.index().then(function (ix) { S.index = ix; }, function () { /* facultatif */ }).then(function () { return Fiche.charger(); }).then(function (f) {
    S.fiche = f; rendreTete();
    var brouillon = null; try { brouillon = JSON.parse(Stock.get('localStorage', 'lettres-brouillon-' + f.id) || 'null'); } catch (e) { /* rien */ }
    if (!(brouillon && brouillon.data && Array.isArray(brouillon.data.lettres))) brouillon = null;
    return lireLettres(f.id).then(function (r) {
      if (r) { S.base = normal(r.data); S.sha = r.sha; S.source = r.source; }
      if (brouillon && (!r || !pareil(normal(brouillon.data), S.base))) {
        S.data = brouillon.data;
        /* le brouillon part de la version qu'il avait sous les yeux : c'est elle qui sert à détecter un conflit */
        if (brouillon.origine) S.origine = normal(brouillon.origine);
        var autre = r && (brouillon.origine ? !pareil(S.origine, S.base) : (brouillon.sha && r.sha && brouillon.sha !== r.sha));
        if (autre) {
          S.avis = 'Les lettres ont aussi été modifiées sur GitHub depuis vos modifications. À l\'enregistrement, vous pourrez choisir quelle version garder ; « Annuler mes modifications » reprend celle de GitHub.';
        } else toast('Vos modifications non enregistrées ont été retrouvées sur cet ordinateur.');
      } else S.data = r ? JSON.parse(JSON.stringify(r.data)) : null;
      if (!S.base && S.data) S.base = { version: 1, valeurs: {}, lettres: [] };
      if (S.data) { normaliser(S.data); memoriser(); }
      rendre();
    }, function (e) {
      if (!brouillon) throw e;
      /* lecture impossible : on travaille sur le brouillon de cet ordinateur */
      S.data = brouillon.data; S.sha = null; S.base = normal(brouillon.origine || { version: 1, valeurs: {}, lettres: [] });
      S.avis = 'Lecture des lettres impossible (' + (e.message || e) + '). Vous travaillez sur les modifications gardées sur cet ordinateur ; rechargez la page avant d\'enregistrer.';
      normaliser(S.data); memoriser(); rendre();
    });
  }).catch(function (e) {
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'card bloc' }, [el('h2', { text: 'Chargement impossible' }), el('div', { class: 'note ko', text: e.message || String(e) })]));
  });
  function normaliser(d) {
    d.version = d.version || 1; d.valeurs = d.valeurs || {}; d.lettres = d.lettres || [];
    d.lettres.forEach(function (l) { l.textes = l.textes || {}; VERSIONS.forEach(function (v) { l.textes[v[0]] = l.textes[v[0]] || { fr: '', en: '' }; }); });
  }

  /* =========================================================
     Rendu
     ========================================================= */
  function rendre() {
    vider();
    var focus = document.activeElement && main.contains(document.activeElement) ? document.activeElement.id : '';
    main.innerHTML = '';
    majEtat();
    if (!S.data) rendreVide();
    else rendreOnglets();
    /* le bouton (ou la liste) utilisé garde le focus après le nouveau rendu */
    var n = focus && document.getElementById(focus);
    if (n && main.contains(n)) n.focus(); else if (focus) { var t = document.getElementById('tab-' + S.onglet); if (t) t.focus(); }
  }
  function rendreOnglets() {
    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['lettres', 'Lettres'], ['valeurs', 'Valeurs de l\'événement'], ['toutes', 'Vérifier et tout télécharger']].forEach(function (o) {
      tabs.appendChild(el('button', { type: 'button', role: 'tab', id: 'tab-' + o[0], 'aria-selected': String(S.onglet === o[0]), onclick: function () { S.onglet = o[0]; rendre(); } }, o[1]));
    });
    main.appendChild(tabs);
    if (S.onglet === 'valeurs') rendreValeurs();
    else if (S.onglet === 'toutes') rendreToutes();
    else rendreLettres();
  }

  function rendreVide() {
    var b = el('div', { class: 'card bloc' });
    b.appendChild(el('h2', { text: 'Pas encore de lettres pour cet événement' }));
    b.appendChild(el('p', { text: 'Reprenez les lettres d\'un autre événement : les textes sont copiés, et les valeurs propres à l\'événement (nom, dates, liens des formulaires…) viennent automatiquement de sa fiche. Si l\'événement copié est d\'un autre type (Célébration ↔ Festival), la page propose de remplacer les termes, avec l\'accord et un aperçu. Vérifiez ensuite l\'onglet « Valeurs ».' }));
    var sel = el('select', { id: 'reprise' });
    var m = el('p', { class: 'msg ko', role: 'alert' });
    var autres = ((S.index && S.index.evenements) || []).filter(function (e) { return e.id !== S.fiche.id; });
    autres.forEach(function (e) { sel.appendChild(el('option', { value: e.id, text: e.nom })); });
    if (!autres.length) b.appendChild(el('p', { class: 'small muted', text: 'Aucun autre événement dans le hub : créez une première lettre.' }));
    b.appendChild(el('div', { class: 'row', style: 'margin-top:10px;align-items:flex-end' }, [el('div', { class: 'fld' }, [el('label', { for: 'reprise', text: 'Reprendre les lettres de' }), sel]), el('button', { class: 'btn btn-o', type: 'button', text: 'Reprendre ces lettres', disabled: !autres.length, onclick: function () {
      var idSource = sel.value;
      m.textContent = '';
      Promise.all([lireLettres(idSource), Fiche.charger(idSource).catch(function () { return null; })]).then(function (res) {
        var r = res[0], ficheSource = res[1];
        if (!r) { m.textContent = 'Cet événement n\'a pas encore de lettres.'; return; }
        var d = JSON.parse(JSON.stringify(r.data));
        /* on garde seulement les valeurs qui ne dépendent pas de l'événement */
        var gardees = {}; ['navettesPrix', 'formule', 'equipe'].forEach(function (k) { if (d.valeurs && d.valeurs[k]) gardees[k] = d.valeurs[k]; });
        d.valeurs = gardees;
        d.lettres.forEach(function (l) { delete l.aRelire; });
        normaliser(d);
        var finir = function (texteToast) {
          S.base = { version: 1, valeurs: {}, lettres: [] }; S.origine = null;
          S.data = d; S.lettre = 0; memoriser(); rendre();
          toast(texteToast || 'Lettres reprises. Relisez l\'onglet « Valeurs », puis « Enregistrer sur GitHub ».');
        };
        if (!ficheSource) { finir('Lettres reprises (fiche de « ' + idSource + ' » illisible : aucun remplacement proposé). Relisez l\'onglet « Valeurs ».'); return; }
        proposerRemplacements(d, ficheSource, finir);
      }).catch(function (e) { m.textContent = 'Erreur : ' + e.message; });
    } }), el('button', { class: 'btn btn-g', type: 'button', text: 'Partir d\'une lettre vide', onclick: function () {
      S.base = { version: 1, valeurs: {}, lettres: [] }; S.origine = null;
      S.data = { version: 1, valeurs: {}, lettres: [] }; S.lettre = 0; memoriser(); rendre(); nouvelleLettre();
    } })]));
    b.appendChild(m);
    main.appendChild(b);
  }

  /* Reprise : Célébration ↔ Festival et nom de l'événement, avec aperçu et nombre par lettre */
  function proposerRemplacements(d, ficheSource, finir) {
    var src = { type: L.typeFiche(ficheSource), nom: ficheSource.nom }, cible = { type: L.typeFiche(S.fiche), nom: S.fiche.nom };
    var plan = L.planReprise(src, cible), total = 0, exemples = {}, parLettre = [];
    var nouveaux = d.lettres.map(function (l) {
      var c = {}, n = 0;
      VERSIONS.forEach(function (v) { c[v[0]] = {}; LANGS.forEach(function (g) {
        var r = L.appliquerReprise(l.textes[v[0]][g[0]] || '', g[0], plan);
        c[v[0]][g[0]] = r.texte; n += r.n;
        r.exemples.forEach(function (x) { var k = x[0] + ' → ' + x[1]; exemples[k] = (exemples[k] || 0) + 1; });
        parLettre.push(r.n);
      }); });
      total += n;
      return c;
    });
    var nomTy = function (x) { return L.TYPES[x] || x; };
    var aideAutre = cible.type === 'autre' && src.type !== 'autre' ? ' Cet événement n\'est ni une Célébration ni un Festival : utilisez « Remplacer dans toutes les lettres » (onglet Valeurs) pour « ' + (src.type === 'festival' ? 'Festival' : 'Célébration') + ' ».' : '';
    if (!total) { finir('Lettres reprises. Relisez l\'onglet « Valeurs », puis « Enregistrer sur GitHub ».' + aideAutre); return; }
    var tb = el('table', { class: 'liste-l', style: 'font-size:13.5px' });
    tb.appendChild(el('thead', null, el('tr', null, [el('th', { text: 'Lettre' })].concat(VERSIONS.reduce(function (a, v) { return a.concat(LANGS.map(function (g) { return el('th', { text: v[1] + ' ' + g[1] }); })); }, [])))));
    var body = el('tbody'), k = 0;
    d.lettres.forEach(function (l) {
      var tr = el('tr', null, [el('td', { text: titreLettre(l) })]);
      VERSIONS.forEach(function () { LANGS.forEach(function () { var n = parLettre[k++]; tr.appendChild(el('td', { text: n ? String(n) : '—', style: n ? 'font-weight:700' : 'color:var(--muted)' })); }); });
      body.appendChild(tr);
    });
    tb.appendChild(body);
    var ex = el('ul', { style: 'margin:6px 0 0;padding-left:20px;font-size:14px' });
    Object.keys(exemples).sort(function (a, b) { return exemples[b] - exemples[a]; }).slice(0, 12).forEach(function (x) { ex.appendChild(el('li', { text: '« ' + x.split(' → ')[0] + ' » → « ' + x.split(' → ')[1] + ' »' + (exemples[x] > 1 ? ' (× ' + exemples[x] + ')' : '') })); });
    var intro = plan.change
      ? 'Les lettres copiées viennent d\'un événement de type « ' + nomTy(src.type) + ' », et celui-ci est un « ' + nomTy(cible.type) + ' ». Les remplacements suivants accordent les mots (la Célébration → le Festival, de la → du, à la → au…).'
      : 'Le nom de l\'événement copié est écrit en toutes lettres dans certaines lettres : il peut être remplacé par celui de cet événement.';
    dialogue({
      titre: total + ' remplacement' + (total > 1 ? 's' : '') + ' proposé' + (total > 1 ? 's' : ''),
      classe: 'large',
      corps: [el('p', { text: intro }), el('div', { style: 'overflow:auto' }, tb), el('p', { class: 'small', style: 'margin:12px 0 0;font-weight:700', text: 'Aperçu :' }), ex,
        el('p', { class: 'small muted', style: 'margin-top:10px', text: 'Les variables KBS [..], les valeurs {..}, les adresses des liens et les adresses e-mail ne sont jamais modifiées. Relisez ensuite chaque lettre : la vérification signale ce qui reste (accords, années…). « Remplacer dans toutes les lettres » (onglet Valeurs) reste disponible.' })],
      boutons: [{ texte: 'Garder les textes tels quels', action: function () { finir('Lettres reprises sans remplacement. La vérification signale les termes à changer.'); } },
        { texte: 'Remplacer (' + total + ')', classe: 'btn-t', action: function () {
          d.lettres.forEach(function (l, i) { VERSIONS.forEach(function (v) { LANGS.forEach(function (g) { l.textes[v[0]][g[0]] = nouveaux[i][v[0]][g[0]]; }); }); });
          finir(total + ' remplacement(s) faits. Relisez les lettres et l\'onglet « Valeurs », puis « Enregistrer sur GitHub ».');
        } }]
    });
  }

  /* ---------- Onglet Lettres ---------- */
  function rendreLettres() {
    if (!S.data.lettres.length) {
      main.appendChild(el('div', { class: 'card bloc' }, [el('h2', { text: 'Aucune lettre' }), el('p', { text: 'Créez une première lettre : un modèle balisé vous est proposé.' }),
        el('button', { class: 'btn btn-o', type: 'button', id: 'btn-nouvelle', text: 'Nouvelle lettre', onclick: nouvelleLettre })]));
      return;
    }
    var l = lettre();
    if (!l) { S.lettre = 0; l = lettre(); }
    var outils = el('div', { class: 'card barre-outils' });
    var selL = el('select', { id: 'choix-lettre', class: 'btn btn-g', style: 'font-weight:700' });
    S.data.lettres.forEach(function (x, i) { selL.appendChild(el('option', { value: String(i), text: titreLettre(x), selected: i === S.lettre })); });
    selL.addEventListener('change', function () { S.lettre = +selL.value; rendre(); });
    var seg = function (items, cle, lab) {
      var g = el('div', { class: 'seg', role: 'group', 'aria-label': lab });
      items.forEach(function (it) { g.appendChild(el('button', { type: 'button', id: 'seg-' + cle + '-' + it[0], 'data-v': it[0], 'aria-pressed': String(S[cle] === it[0]), text: it[1], onclick: function () { S[cle] = it[0]; rendre(); } })); });
      return g;
    };
    outils.appendChild(el('div', { class: 'fld' }, [el('label', { class: 'lbl', for: 'choix-lettre', text: 'Lettre' }), selL]));
    outils.appendChild(el('div', { class: 'fld' }, [el('span', { class: 'lbl', text: 'Version' }), seg(VERSIONS, 'version', 'Version')]));
    outils.appendChild(el('div', { class: 'fld' }, [el('span', { class: 'lbl', text: 'Langue' }), seg(LANGS, 'lang', 'Langue')]));
    outils.appendChild(el('div', { class: 'fld', style: 'margin-left:auto' }, [el('span', { class: 'lbl', html: '&nbsp;' }), el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-g btn-sm', type: 'button', id: 'btn-nouvelle', text: 'Nouvelle lettre', onclick: nouvelleLettre }),
      el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Renommer', onclick: renommer }),
      el('button', { class: 'btn btn-g btn-sm', type: 'button', text: 'Supprimer', onclick: supprimer })
    ])]));
    main.appendChild(outils);

    var textes = l.textes[S.version];
    var ta = el('textarea', { id: 'texte', spellcheck: 'true', lang: S.lang, 'aria-label': 'Texte de la lettre (balisé)' });
    ta.value = textes[S.lang] || '';
    var aRelire = l.aRelire && l.aRelire[S.version];
    var titreEd = el('h2', { html: esc(titreLettre(l)) + ' <span class="muted" style="font-size:15px;font-family:inherit">— ' + (S.version === 'streaming' ? 'streaming' : 'présentiel') + ' · ' + S.lang.toUpperCase() + '</span>' + (aRelire ? '<span class="badge" title="Texte rédigé à partir de la version présentiel : à relire avant de le charger dans KBS">À relire</span>' : '') });
    var colEd = el('div', { class: 'card bloc editeur' }, [titreEd]);
    if (l.quand) colEd.appendChild(el('p', { class: 'small muted', style: 'margin:0 0 8px', text: L.t(l.quand, 'fr') }));
    if (aRelire) colEd.appendChild(el('div', { class: 'note warn', style: 'margin-bottom:10px' }, [el('span', { text: 'Version rédigée à partir de la lettre présentiel. Relisez-la, puis ' }), el('button', { class: 'btn-link', type: 'button', text: 'marquez-la comme relue', onclick: function () { delete l.aRelire[S.version]; if (!Object.keys(l.aRelire).length) delete l.aRelire; memoriser(); rendre(); } }), el('span', { text: '.' })]));
    colEd.appendChild(ta);
    colEd.appendChild(aideBalisage(ta));
    var zoneVerif = el('div', { class: 'verif', id: 'verif' });
    var papier = el('div', { class: 'papier', lang: S.lang });
    var nomF = el('code', { id: 'nom-fichier', style: 'font-size:12.5px;word-break:break-all' });
    var colAp = el('div', { class: 'panel', style: 'gap:12px' }, [
      zoneVerif,
      el('div', { class: 'row between' }, [nomF, el('button', { class: 'btn btn-t', type: 'button', id: 'btn-docx', text: 'Télécharger le .docx', onclick: function () {
        demanderDocx(l, S.version, S.lang, function () { var x = preparer(l, S.version, S.lang).verif.erreurs[0]; if (x && x.n) allerLigne(ta, x.n); else ta.focus(); });
      } })]),
      el('div', { class: 'papier-wrap', role: 'region', 'aria-label': 'Aperçu de la lettre', tabindex: '0' }, papier)
    ]);
    main.appendChild(el('div', { class: 'duo-l' }, [colEd, colAp]));

    var minuterie = null;
    function maj() {
      var p = preparer(l, S.version, S.lang);
      papier.innerHTML = L.html(p.paras);
      nomF.textContent = nomFichier(l, S.version, S.lang);
      rendreVerif(zoneVerif, p.verif, ta, aRelire);
    }
    var etape = function () { clearTimeout(minuterie); enAttente = null; memoriser(); maj(); };
    ta.addEventListener('input', function () {
      textes[S.lang] = ta.value; clearTimeout(minuterie);
      if (!S.sale) { S.sale = true; majEtat(); }
      enAttente = etape;
      minuterie = setTimeout(etape, 250);
    });
    maj();
  }
  var annonceMin = null, annonceDerniere = '';
  function annoncer(t) {
    clearTimeout(annonceMin);
    annonceMin = setTimeout(function () { if (t === annonceDerniere) return; annonceDerniere = t; var z = document.getElementById('annonce'); if (z) z.textContent = t; }, 1500);
  }
  function rendreVerif(zone, v, ta, relire) {
    annoncer(v.erreurs.length ? v.erreurs.length + ' point(s) à corriger.' : v.avertissements.length ? v.avertissements.length + ' point(s) à vérifier.' : relire ? 'Aucune erreur, mais version à relire.' : 'Lettre prête pour KBS.');
    zone.innerHTML = '';
    zone.className = 'verif ' + (v.erreurs.length ? 'ko' : v.avertissements.length || relire ? 'warn' : 'ok');
    if (!v.erreurs.length && !v.avertissements.length) { zone.appendChild(el('strong', { text: relire ? '✓ Aucune erreur (variables, liens et termes vérifiés), mais cette version est « À relire » (voir la note au-dessus du texte).' : '✓ Prête pour KBS : variables autorisées, liens et termes vérifiés.' })); return; }
    zone.appendChild(el('strong', { text: v.erreurs.length ? v.erreurs.length + ' point(s) à corriger avant KBS' : 'À vérifier (n\'empêche pas l\'envoi)' }));
    var ul = el('ul');
    v.erreurs.concat(v.avertissements).forEach(function (x, i) {
      var li = el('li', { style: i < v.erreurs.length ? 'color:var(--ko)' : '' });
      if (x.n && ta) li.appendChild(el('button', { class: 'btn-link', type: 'button', text: 'Ligne ' + x.n, onclick: function () { allerLigne(ta, x.n); } }));
      li.appendChild(document.createTextNode((x.n && ta ? ' : ' : '') + (i < v.erreurs.length ? 'Erreur : ' : 'À vérifier : ') + x.texte));
      ul.appendChild(li);
    });
    zone.appendChild(ul);
  }
  function allerLigne(ta, n) {
    var lignes = ta.value.split('\n'), debut = 0;
    for (var i = 0; i < n - 1 && i < lignes.length; i++) debut += lignes[i].length + 1;
    ta.focus(); ta.setSelectionRange(debut, debut + (lignes[n - 1] || '').length);
    var h = ta.scrollHeight / Math.max(1, lignes.length); ta.scrollTop = Math.max(0, (n - 4) * h);
  }
  function aideBalisage(ta) {
    var d = el('details', { class: 'dep', style: 'margin-top:12px' });
    d.appendChild(el('summary', { text: 'Aide : balisage et valeurs de l\'événement' }));
    var tb = el('table', { class: 'aide-tab' });
    L.BALISAGE.forEach(function (b) { tb.appendChild(el('tr', null, [el('td', { text: b[0] }), el('td', { text: b[1] })])); });
    d.appendChild(tb);
    d.appendChild(el('p', { class: 'small muted', style: 'margin:10px 0 0', text: 'Cliquer sur une valeur l\'insère à l\'emplacement du curseur :' }));
    var pv = el('div', { class: 'puces-val' }), V = valeurs();
    L.VALEURS.forEach(function (v) {
      pv.appendChild(el('button', { type: 'button', title: v.nom + ' : ' + (V[v.cle][S.lang] || '(vide)'), text: '{' + v.cle + '}', onclick: function () { inserer(ta, '{' + v.cle + '}'); } }));
    });
    d.appendChild(pv);
    d.appendChild(el('p', { class: 'small muted', style: 'margin:10px 0 0', html: 'Variables KBS autorisées : ' + L.VARIABLES_KBS.map(function (v) { return '<code>[' + v + ']</code>'; }).join(' ') }));
    return d;
  }
  function inserer(ta, s) {
    var a = ta.selectionStart, b = ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + s + ta.value.slice(b);
    ta.focus(); ta.setSelectionRange(a + s.length, a + s.length);
    ta.dispatchEvent(new Event('input'));
  }
  var SQUELETTE = {
    presentiel: { fr: '@entete\n# Titre de la lettre\n@sous-titre {sousTitre}\n@salutation [DearOne],\nTexte d\'introduction.\n## Première partie\nTexte.\n@signature\n@pied {lieu} — kadampafrance.org', en: '@entete\n# Letter title\n@sous-titre {sousTitre}\n@salutation [DearOne],\nIntroduction.\n## First part\nText.\n@signature\n@pied {lieu} — kadampafrance.org' },
    streaming: { fr: '@entete\n# Titre de la lettre\n@sous-titre {sousTitre}\n@info **Réf. d\'inscription : **[ref]\n[event]\n[DearOne],\nTexte d\'introduction.\n## Première partie\nTexte.\n---\n@signature-kbs\n@pied {centre} — {lieu}', en: '@entete\n# Letter title\n@sous-titre {sousTitre}\n@info **Booking ref: **[ref]\n[event]\n[DearOne],\nIntroduction.\n## First part\nText.\n---\n@signature-kbs\n@pied {centre} — {lieu}, France' }
  };
  function nouvelleLettre() {
    var nom = el('input', { type: 'text', id: 'nl-nom', placeholder: 'ex. Confirmation de vos navettes' });
    var num = el('input', { type: 'text', id: 'nl-num', placeholder: 'ex. 05', style: 'max-width:90px' });
    var copie = el('input', { type: 'checkbox', id: 'nl-copie' }), modele = lettre();
    dialogue({
      titre: 'Nouvelle lettre',
      corps: [el('div', { class: 'grid2' }, [el('div', { class: 'fld' }, [el('label', { for: 'nl-nom', text: 'Nom' }), nom]), el('div', { class: 'fld' }, [el('label', { for: 'nl-num', text: 'Numéro (nom du fichier)' }), num])]),
        modele ? el('label', { class: 'chk', style: 'margin-top:12px' }, [copie, el('span', { text: 'Partir d\'une copie de « ' + titreLettre(modele) + ' »' })]) : null],
      boutons: [{ texte: 'Annuler' }, { texte: 'Créer', classe: 'btn-t', action: function () {
        if (!nom.value.trim()) { nom.focus(); return false; }
        var n = nom.value.trim(), idl = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || U.uid('l');
        var ids = S.data.lettres.map(function (x) { return x.id; }), base = idl, k = 2;
        while (ids.indexOf(idl) > -1) idl = base + '-' + (k++);
        var cp = copie.checked && modele;
        var l = { id: idl, num: num.value.trim(), nom: { fr: n, en: n }, fichier: {}, textes: cp ? JSON.parse(JSON.stringify(modele.textes)) : JSON.parse(JSON.stringify(SQUELETTE)) };
        if (cp && modele.mise) l.mise = JSON.parse(JSON.stringify(modele.mise));
        S.data.lettres.push(l); S.lettre = S.data.lettres.length - 1; memoriser(); rendre();
      } }]
    });
  }
  function renommer() {
    var l = lettre();
    var nomFr = el('input', { type: 'text', id: 'rn-fr', value: L.t(l.nom, 'fr') }), nomEn = el('input', { type: 'text', id: 'rn-en', value: (l.nom && l.nom.en) || '' });
    var num = el('input', { type: 'text', id: 'rn-num', value: l.num || '' });
    var fic = {}; VERSIONS.forEach(function (v) { LANGS.forEach(function (g) { fic[v[0] + g[0]] = el('input', { type: 'text', value: (l.fichier && l.fichier[v[0]] && l.fichier[v[0]][g[0]]) || '', placeholder: L.t(l.nom, g[0]) }); }); });
    dialogue({
      titre: 'Renommer « ' + titreLettre(l) + ' »',
      corps: [el('div', { class: 'grid3' }, [el('div', { class: 'fld' }, [el('label', { for: 'rn-fr', text: 'Nom (FR)' }), nomFr]), el('div', { class: 'fld' }, [el('label', { for: 'rn-en', text: 'Nom (EN)' }), nomEn]), el('div', { class: 'fld' }, [el('label', { for: 'rn-num', text: 'Numéro' }), num])]),
        el('p', { class: 'small muted', style: 'margin:14px 0 6px', text: 'Mot utilisé dans le nom des fichiers .docx :' }),
        el('div', { class: 'grid2' }, VERSIONS.reduce(function (a, v) { return a.concat(LANGS.map(function (g) { var inp = fic[v[0] + g[0]]; inp.id = 'rn-' + v[0] + g[0]; return el('div', { class: 'fld' }, [el('label', { for: inp.id, text: v[1] + ' ' + g[1] }), inp]); })); }, []))],
      boutons: [{ texte: 'Annuler' }, { texte: 'Enregistrer', classe: 'btn-t', action: function () {
        if (!nomFr.value.trim()) return false;
        l.nom = { fr: nomFr.value.trim(), en: nomEn.value.trim() }; l.num = num.value.trim();
        l.fichier = {}; VERSIONS.forEach(function (v) { LANGS.forEach(function (g) { var x = fic[v[0] + g[0]].value.trim(); if (x) { l.fichier[v[0]] = l.fichier[v[0]] || {}; l.fichier[v[0]][g[0]] = x; } }); });
        memoriser(); rendre();
      } }]
    });
  }
  function supprimer() {
    var l = lettre();
    confirmer('Supprimer « ' + titreLettre(l) + ' » ?', 'Ses quatre versions (présentiel, streaming, FR, EN) seront retirées de cet événement après « Enregistrer sur GitHub ».', 'Supprimer', true).then(function (ok) {
      if (!ok) return; S.data.lettres.splice(S.lettre, 1); S.lettre = Math.max(0, S.lettre - 1); memoriser(); rendre();
    });
  }

  /* ---------- Onglet Valeurs ---------- */
  function rendreValeurs() {
    var b = el('div', { class: 'card bloc' });
    b.appendChild(el('h2', { text: 'Valeurs de l\'événement' }));
    b.appendChild(el('p', { html: 'Les lettres les utilisent sous la forme <code>{nom}</code>. La plupart viennent de la <a href="/preparer/?evt=' + encodeURIComponent(S.fiche.id) + '">fiche de l\'événement</a> (nom, dates, dates clés, liens, contacts). <strong>Une case remplie ici remplace la valeur de la fiche</strong> pour les lettres seulement ; vide = valeur de la fiche.' }));
    var V = L.valeursFiche(S.fiche), tb = el('table', { class: 'table-val' }), groupe = '';
    tb.appendChild(el('thead', null, el('tr', null, [el('th', { text: 'Valeur' }), el('th', { text: 'Français' }), el('th', { text: 'Anglais' })])));
    var body = el('tbody');
    L.VALEURS.forEach(function (v) {
      if (v.groupe !== groupe) { groupe = v.groupe; body.appendChild(el('tr', { class: 'groupe' }, el('td', { colspan: '3', text: groupe }))); }
      var cellule = function (lang) {
        var s = (S.data.valeurs[v.cle] || {})[lang] || '', f = (V[v.cle] || {})[lang] || '';
        var inp = el('input', { type: v.lien ? 'url' : 'text', value: s, placeholder: f || (v.ex ? 'ex. ' + v.ex : '(vide)'), 'aria-label': v.nom + ' (' + lang.toUpperCase() + ')', spellcheck: v.lien ? 'false' : 'true' });
        var src = el('div', { class: 'src', text: s ? 'Remplace la fiche' : f ? 'Fiche' : 'À remplir' });
        if (!s && !f) src.style.color = 'var(--ko)';
        inp.addEventListener('input', function () {
          var x = inp.value;
          S.data.valeurs[v.cle] = S.data.valeurs[v.cle] || {};
          if (x) S.data.valeurs[v.cle][lang] = x; else delete S.data.valeurs[v.cle][lang];
          if (!Object.keys(S.data.valeurs[v.cle]).length) delete S.data.valeurs[v.cle];
          src.textContent = x ? 'Remplace la fiche' : f ? 'Fiche' : 'À remplir'; src.style.color = !x && !f ? 'var(--ko)' : '';
          memoriser();
        });
        return el('td', null, [inp, src]);
      };
      body.appendChild(el('tr', null, [el('td', null, [el('div', { text: v.nom }), el('code', { text: '{' + v.cle + '}' })]), cellule('fr'), cellule('en')]));
    });
    tb.appendChild(body);
    b.appendChild(el('div', { style: 'overflow:auto' }, tb));
    main.appendChild(b);

    /* rechercher / remplacer dans toutes les lettres */
    var r = el('div', { class: 'card bloc' });
    r.appendChild(el('h2', { text: 'Remplacer dans toutes les lettres' }));
    r.appendChild(el('p', { text: 'Pratique pour un nouvel événement (ex. « la Célébration » → « la retraite »). La casse est respectée. Attention à l\'accord : « la Célébration » → « le Festival », « de la Célébration » → « du Festival ».' }));
    var de = el('input', { type: 'text', id: 'rr-de' }), par = el('input', { type: 'text', id: 'rr-par' }), m = el('p', { class: 'msg', role: 'status' });
    r.appendChild(el('div', { class: 'grid2' }, [el('div', { class: 'fld' }, [el('label', { for: 'rr-de', text: 'Remplacer' }), de]), el('div', { class: 'fld' }, [el('label', { for: 'rr-par', text: 'Par' }), par])]));
    r.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn btn-t', type: 'button', text: 'Remplacer partout', onclick: function () {
      if (!de.value) return;
      var cible = de.value, rempl = par.value;
      var n = compter(cible);
      if (!n) { m.textContent = 'Aucune occurrence de « ' + cible + ' » (les variables [..], valeurs {..}, adresses des liens et adresses e-mail ne sont pas modifiées).'; return; }
      confirmer('Remplacer ' + n + ' fois ?', '« ' + cible + ' » sera remplacé par « ' + rempl + ' » dans toutes les lettres (présentiel, streaming, FR, EN). Les variables KBS, les valeurs {…}, les adresses des liens et les adresses e-mail ne sont pas touchées.', 'Remplacer ' + n + ' fois').then(function (ok) {
        if (!ok) return;
        S.data.lettres.forEach(function (l) { VERSIONS.forEach(function (v) { LANGS.forEach(function (g) {
          l.textes[v[0]][g[0]] = remplacerTexte(l.textes[v[0]][g[0]] || '', cible, rempl);
        }); }); });
        m.textContent = n + ' remplacement(s).'; memoriser();
      });
    } }), m]));
    main.appendChild(r);
  }

  /* morceaux protégés (lettres.js) : adresse d'un lien « ](…) », variable KBS [x], valeur {x}, adresse e-mail ou web */
  var morceaux = L.morceaux;
  function remplacerTexte(s, de, par) { return morceaux(s).map(function (p) { return p[1] ? p[0].split(de).join(par) : p[0]; }).join(''); }
  function compter(de) {
    var n = 0;
    S.data.lettres.forEach(function (l) { VERSIONS.forEach(function (v) { LANGS.forEach(function (g) {
      morceaux(l.textes[v[0]][g[0]] || '').forEach(function (p) { if (p[1]) n += p[0].split(de).length - 1; });
    }); }); });
    return n;
  }

  /* ---------- Onglet Vérifier et tout télécharger ---------- */
  /* Toutes les versions non vides : [{ l, i, v, g, p, e, w, relire }] */
  function versions() {
    var out = [];
    S.data.lettres.forEach(function (l, i) { VERSIONS.forEach(function (v) { LANGS.forEach(function (g) {
      if (!(l.textes[v[0]][g[0]] || '').trim()) return;
      var p = preparer(l, v[0], g[0]);
      out.push({ l: l, i: i, v: v, g: g, p: p, e: p.verif.erreurs.length, w: p.verif.avertissements.length, relire: aRelire(l, v[0]) });
    }); }); });
    return out;
  }
  function termeType() { var ty = L.typeFiche(S.fiche); return ty === 'festival' ? 'terme « Festival »' : ty === 'celebration' ? 'terme « Célébration »' : 'termes Célébration / Festival'; }
  function rendreToutes() {
    var b = el('div', { class: 'card bloc' });
    b.appendChild(el('h2', { text: 'Toutes les lettres' }));
    b.appendChild(el('p', { text: 'Chaque lettre est vérifiée pour KBS : variables autorisées, liens publics (jamais /edit), ' + termeType() + ', valeurs remplies. Une lettre « À relire » ou avec des points « à corriger » n\'est pas comptée comme prête.' }));
    var tb = el('table', { class: 'liste-l' }), liste = versions(), ok = 0;
    tb.appendChild(el('thead', null, el('tr', null, [el('th', { text: 'Lettre' }), el('th', { text: 'Version' }), el('th', { text: 'Langue' }), el('th', { text: 'Vérification' }), el('th', { text: 'Fichier' })])));
    var body = el('tbody');
    liste.forEach(function (x) {
      if (!x.e && !x.relire) ok++;
      var etat = [];
      if (x.e) etat.push(el('span', { class: 'badge ko', style: 'margin:0 6px 0 0', text: x.e + ' à corriger' }));
      if (x.relire) etat.push(el('span', { class: 'badge', style: 'margin:0 6px 0 0', text: 'À relire' }));
      if (x.w) etat.push(el('span', { class: 'badge', style: 'margin:0 6px 0 0', text: x.w + ' à vérifier' }));
      if (!etat.length) etat.push(el('span', { class: 'badge ok', style: 'margin:0', text: 'Prête' }));
      body.appendChild(el('tr', null, [
        el('td', null, el('button', { class: 'btn-link', type: 'button', text: titreLettre(x.l), onclick: function () { S.lettre = x.i; S.version = x.v[0]; S.lang = x.g[0]; S.onglet = 'lettres'; rendre(); } })),
        el('td', { text: x.v[1] }), el('td', { text: x.g[1] }), el('td', null, etat),
        el('td', null, el('button', { class: 'btn-link', type: 'button', text: nomFichier(x.l, x.v[0], x.g[0]), onclick: function () { demanderDocx(x.l, x.v[0], x.g[0], function () { S.lettre = x.i; S.version = x.v[0]; S.lang = x.g[0]; S.onglet = 'lettres'; rendre(); }); } }))
      ]));
    });
    tb.appendChild(body);
    b.appendChild(el('div', { style: 'overflow:auto' }, tb));
    b.appendChild(el('div', { class: 'row', style: 'margin-top:14px' }, [
      el('button', { class: 'btn btn-o', type: 'button', id: 'btn-zip', text: 'Télécharger les ' + liste.length + ' lettres (.zip)', disabled: !liste.length, onclick: function () { demanderZip(versions()); } }),
      el('span', { class: 'small muted', id: 'nb-pretes', text: ok + ' / ' + liste.length + ' prêtes pour KBS' })
    ]));
    main.appendChild(b);
  }
  function telechargerZip(liste) {
    var fichiers = [], pris = {};
    liste.forEach(function (x) {
      var nom = nomFichier(x.l, x.v[0], x.g[0]), k = 2, racineNom = nom.replace(/\.docx$/, '');
      while (pris[nom.toLowerCase()]) nom = racineNom + '_' + (k++) + '.docx';
      pris[nom.toLowerCase()] = true;
      fichiers.push([nom, L.docx(x.p.paras, L.gabarit(x.l, x.v[0]), nom)]);
    });
    U.telecharger('Lettres_' + (S.fiche.code || S.fiche.id) + '.zip', new Blob([L.zip(fichiers)], { type: 'application/zip' }));
  }
  /* Le .zip ne prend pas en silence les lettres en erreur : on demande (par défaut, elles sont exclues) */
  function demanderZip(liste) {
    var ko = liste.filter(function (x) { return x.e; }), relire = liste.filter(function (x) { return x.relire && !x.e; });
    if (!ko.length) {
      telechargerZip(liste);
      if (relire.length) toast('Téléchargé. ' + relire.length + ' lettre(s) « À relire » : relisez-les avant de les charger dans KBS.');
      return;
    }
    var exclure = el('input', { type: 'radio', name: 'zip-choix', id: 'zip-exclure', checked: true }), inclure = el('input', { type: 'radio', name: 'zip-choix', id: 'zip-inclure' });
    var ul = el('ul', { style: 'margin:6px 0 0;padding-left:20px' });
    ko.forEach(function (x) { ul.appendChild(el('li', { text: nomFichier(x.l, x.v[0], x.g[0]) + ' — ' + x.e + ' à corriger' })); });
    var reste = liste.length - ko.length;
    dialogue({
      titre: ko.length + ' lettre' + (ko.length > 1 ? 's' : '') + ' pas prête' + (ko.length > 1 ? 's' : '') + ' pour KBS',
      corps: [el('div', { class: 'note ko' }, [el('strong', { text: 'Ces lettres ont des points à corriger :' }), ul]),
        el('div', { style: 'margin-top:12px;display:grid;gap:8px' }, [
          el('label', { class: 'chk' }, [exclure, el('span', { text: 'Les laisser hors du .zip (conseillé) : ' + reste + ' lettre' + (reste > 1 ? 's' : '') + ' téléchargée' + (reste > 1 ? 's' : '') })]),
          el('label', { class: 'chk' }, [inclure, el('span', { text: 'Les inclure quand même (' + liste.length + ' lettres) : essai ou relecture seulement' })])]),
        relire.length ? el('p', { class: 'small muted', style: 'margin-top:10px', text: relire.length + ' autre(s) lettre(s) « À relire » sont incluses : relisez-les avant de les charger dans KBS.' }) : null],
      boutons: [{ texte: 'Annuler' }, { texte: 'Télécharger le .zip', classe: 'btn-t', action: function () {
        var choix = inclure.checked ? liste : liste.filter(function (x) { return !x.e; });
        if (!choix.length) { toast('Aucune lettre sans erreur à télécharger.'); return; }
        telechargerZip(choix);
        toast(inclure.checked ? 'Téléchargé avec ' + ko.length + ' lettre(s) en erreur : ne pas les charger dans KBS telles quelles.' : choix.length + ' lettre(s) téléchargée(s) ; ' + ko.length + ' laissée(s) de côté.');
      } }]
    });
  }

  /* =========================================================
     GitHub : connexion et enregistrement
     ========================================================= */
  function connexionGH() {
    var jeton = el('input', { type: 'password', id: 'gh-jeton', autocomplete: 'off', spellcheck: 'false', value: S.gh.token });
    var souv = el('input', { type: 'checkbox', id: 'gh-souv', checked: S.gh.souvenir });
    var m = el('p', { class: 'msg', role: 'status' });
    dialogue({
      titre: 'Connexion GitHub',
      corps: [el('p', { html: 'Le même jeton que pour la page <a href="/preparer/">Préparer</a> : <em>fine-grained</em>, propriétaire <code>kmcfrance</code>, dépôt <code>kmcfrance.github.io</code>, permission <strong>Contents : Read and write</strong>. Il n\'est envoyé qu\'à api.github.com.' }),
        el('div', { class: 'fld' }, [el('label', { for: 'gh-jeton', text: 'Jeton GitHub' }), jeton]),
        el('label', { class: 'chk', style: 'margin-top:10px' }, [souv, el('span', { text: 'Se souvenir sur cet ordinateur (ordinateur personnel uniquement)' })]), m],
      boutons: [
        { texte: 'Oublier le jeton', action: function () { S.gh.token = ''; S.gh.souvenir = false; sauverGH(); rendreTete(); } },
        { texte: 'Annuler' },
        { texte: 'Se connecter', classe: 'btn-t', action: function (d, bt) {
          var ancien = S.gh.token, ancienSouv = S.gh.souvenir;
          S.gh.token = jeton.value.trim(); S.gh.souvenir = souv.checked;
          if (!S.gh.token) { m.className = 'msg ko'; m.textContent = 'Collez le jeton.'; return false; }
          bt.disabled = true; m.className = 'msg'; m.textContent = 'Vérification…';
          return gh('GET', depot()).then(function (r) {
            if (r && r.permissions && r.permissions.push === false) throw new Error('Ce compte n\'a pas le droit de modifier le dépôt.');
            sauverGH(); rendreTete(); toast('Connecté à GitHub');
            rattacher();
          }).catch(function (e) { S.gh.token = ancien; S.gh.souvenir = ancienSouv; bt.disabled = false; m.className = 'msg ko'; m.textContent = e.message; return false; });
        } }
      ]
    });
  }
  /* lettres lues sur le site (sans sha) : si GitHub a le même contenu, on retient son sha */
  function rattacher() {
    if (!S.data || S.sha || !S.fiche) return;
    gh('GET', depot() + '/contents/' + chemin(S.fiche.id) + '?ref=' + encodeURIComponent(DEPOT.branch)).then(function (c) {
      var d = null; try { d = JSON.parse(deb64(c.content)); } catch (e) { return; }
      if (pareil(normal(d), S.base)) { S.sha = c.sha; S.source = 'github'; majEtat(); }
    }, function () { /* rien : vérifié de nouveau à l'enregistrement */ });
  }
  function enregistrer() {
    if (!S.gh.token) { connexionGH(); return; }
    var bt = document.getElementById('btn-enr'); if (bt) bt.disabled = true;
    var texte = JSON.stringify(S.data, null, 2) + '\n', ch = chemin(S.fiche.id);
    gh('GET', depot() + '/contents/' + ch + '?ref=' + encodeURIComponent(DEPOT.branch)).then(function (c) { return c; }, function (e) { if (e.status === 404) return null; throw e; }).then(function (actuel) {
      var shaActuel = actuel && actuel.sha, contenuActuel = null;
      if (actuel) { try { contenuActuel = JSON.parse(deb64(actuel.content)); normal(contenuActuel); } catch (e) { contenuActuel = undefined; } }
      var suite = function () {
        return gh('PUT', depot() + '/contents/' + ch, { message: 'Lettres KBS : ' + (S.fiche.code || S.fiche.id), content: b64(texte), branch: DEPOT.branch, sha: shaActuel || undefined }).then(function (r) {
          S.sha = r && r.content ? r.content.sha : null; S.base = JSON.parse(texte); S.origine = null; S.source = 'github'; S.avis = '';
          memoriser(); rendre();
          toast('Enregistré sur GitHub. Le site suit en 1 à 2 minutes.');
        });
      };
      /* quelqu'un d'autre a enregistré entre-temps ? */
      /* sans sha (lettres lues sur le site, ou nouvelles) : on compare le contenu à celui de départ */
      var change = !!actuel && (contenuActuel === undefined ? shaActuel !== S.sha : !pareil(normal(contenuActuel), normal(origine())));
      if (change) {
        return confirmer('Les lettres ont changé sur GitHub', 'Une autre version a été enregistrée sur GitHub depuis que vous avez commencé vos modifications. Enregistrer quand même la remplacera par la vôtre. (Pour la garder : « Télécharger lettres.json » par sécurité, puis « Annuler mes modifications ».)', 'Remplacer par ma version', true).then(function (ok) { if (ok) return suite(); if (bt) bt.disabled = false; });
      }
      return suite();
    }).catch(function (e) { if (bt) bt.disabled = false; dialogue({ titre: 'Enregistrement impossible', corps: [el('div', { class: 'note ko', text: e.message }), el('p', { text: 'Vos modifications restent gardées sur cet ordinateur. Vous pouvez aussi « Télécharger lettres.json » et le déposer à la main dans evenements/' + S.fiche.id + '/ sur GitHub.' })], boutons: [{ texte: 'Fermer', classe: 'btn-t' }] }); });
  }
})();
