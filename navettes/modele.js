/* =========================================================
   Modèle de départ du formulaire Navettes.
   Utilisé une seule fois par événement (« Partir du modèle » dans l'admin) :
   ensuite, tout se modifie dans l'admin, onglet Questions.
   Repris du formulaire Google de la Célébration du Dharma 2026 ;
   les dates viennent de la fiche (premier et dernier jour).
   ========================================================= */
(function () {
  'use strict';
  var F = window.Formulaires, D = F.dates;
  function contact(fiche, re, defaut) {
    var c = (fiche.contacts || []).filter(function (x) { return x.email && re.test(x.role || ''); })[0];
    return c ? c.email : defaut;
  }

  F.modeles = F.modeles || {};
  /* Version CD2026 (Célébration du Dharma 2026, en test en parallèle des Google Forms) :
     horaires, dates limites et textes propres à la Célébration. */
  var CD2026 = {
    "titre": {
      "fr": "Navettes gare d'Ecommoy ↔ CMK France",
      "en": "Shuttles Ecommoy station ↔ KMC France"
    },
    "intro": {
      "fr": "Des navettes relient la gare d'Ecommoy et le Centre de Méditation Kadampa France :\n**vendredi 27 novembre** (arrivées), entre 12h30 et 19h15 ;\n**lundi 30 novembre** (départs), entre 13h et 18h30.\nIl n'y a pas de navette le samedi et le dimanche.\n\n**5 € par trajet.** Réservation au plus tard le **24 novembre**.\nIndiquez les horaires de vos trains : nous regroupons les participants par navette et nous vous confirmons l'horaire.",
      "en": "Shuttles run between Ecommoy station and the Kadampa Meditation Centre France:\n**Friday 27 November** (arrivals), between 12:30 and 19:15;\n**Monday 30 November** (departures), between 13:00 and 18:30.\nThere is no shuttle on Saturday and Sunday.\n\n**€5 per trip.** Book by **24 November** at the latest.\nPlease give your train times: we group participants by shuttle and confirm your time with you."
    },
    "questions": [
      {
        "id": "email",
        "type": "email",
        "requis": true,
        "auto": "email",
        "label": {
          "fr": "E-mail",
          "en": "E-mail"
        },
        "aide": {
          "fr": "L'adresse utilisée pour votre inscription.",
          "en": "The address used for your booking."
        }
      },
      {
        "id": "prenom",
        "type": "texte",
        "requis": true,
        "auto": "given-name",
        "label": {
          "fr": "Prénom",
          "en": "First name"
        }
      },
      {
        "id": "nom",
        "type": "texte",
        "requis": true,
        "auto": "family-name",
        "label": {
          "fr": "Nom",
          "en": "Last name"
        }
      },
      {
        "id": "tel",
        "type": "tel",
        "label": {
          "fr": "Téléphone portable",
          "en": "Mobile phone"
        },
        "aide": {
          "fr": "Facultatif : pour vous joindre le jour du trajet.",
          "en": "Optional: to reach you on the day of travel."
        }
      },
      {
        "id": "s_aller",
        "type": "section",
        "label": {
          "fr": "Aller : vendredi 27 novembre",
          "en": "Arrival: Friday 27 November"
        }
      },
      {
        "id": "aller_non",
        "type": "case",
        "label": {
          "fr": "Je n'ai pas besoin de la navette à l'aller",
          "en": "I do not need the shuttle on arrival"
        }
      },
      {
        "id": "train_aller",
        "type": "texte",
        "requis": true,
        "condition": {
          "q": "aller_non",
          "op": "pasCoche"
        },
        "label": {
          "fr": "Horaire d'arrivée de votre train le vendredi 27 novembre en gare d'Ecommoy (entre 12h30 et 19h15)",
          "en": "Arrival time of your train at Ecommoy station on Friday 27 November (between 12:30 and 19:15)"
        },
        "aide": {
          "fr": "Exemple : 14h32",
          "en": "Example: 14:32"
        }
      },
      {
        "id": "s_retour",
        "type": "section",
        "label": {
          "fr": "Retour : lundi 30 novembre",
          "en": "Departure: Monday 30 November"
        }
      },
      {
        "id": "retour_non",
        "type": "case",
        "label": {
          "fr": "Je n'ai pas besoin de la navette au retour",
          "en": "I do not need the shuttle on departure"
        }
      },
      {
        "id": "train_retour",
        "type": "texte",
        "requis": true,
        "condition": {
          "q": "retour_non",
          "op": "pasCoche"
        },
        "label": {
          "fr": "Horaire de départ de votre train le lundi 30 novembre en gare d'Ecommoy (entre 13h et 18h30)",
          "en": "Departure time of your train from Ecommoy station on Monday 30 November (between 13:00 and 18:30)"
        },
        "aide": {
          "fr": "Exemple : 16h05",
          "en": "Example: 16:05"
        }
      },
      {
        "id": "commentaire",
        "type": "paragraphe",
        "label": {
          "fr": "Commentaire",
          "en": "Comment"
        }
      }
    ],
    "merci": {
      "fr": "Nous vous confirmerons l'horaire de votre navette. Pour toute question : 02 43 87 71 02.",
      "en": "We will confirm your shuttle time with you. Any question: +33 2 43 87 71 02."
    },
    "ferme": {
      "fr": "Les réservations de navettes sont closes (date limite : 24 novembre).",
      "en": "Shuttle bookings are closed (deadline: 24 November)."
    },
    "rgpd": {
      "fr": "Vos réponses servent uniquement à organiser les navettes de la Célébration. Elles sont lues par l'équipe d'organisation du Centre de Méditation Kadampa France et supprimées après l'événement. Pour les consulter, les corriger ou les faire supprimer : inscriptions-festival@kadampafrance.org.",
      "en": "Your answers are used only to organise the shuttles for the Celebration. They are read by the organising team of the Kadampa Meditation Centre France and deleted after the event. To see, correct or delete them: inscriptions-festival@kadampafrance.org."
    },
    "contact": "inscriptions-festival@kadampafrance.org"
  };

  F.modeles.navettes = function (fiche) {
    if (fiche.id === 'cd2026') return JSON.parse(JSON.stringify(CD2026));
    var aller = D.dateValide(fiche.debut) ? fiche.debut : '', retour = D.dateValide(fiche.fin) ? fiche.fin : '';
    var jA = { fr: aller ? D.jourTexte(aller, 'fr') : 'premier jour', en: aller ? D.jourTexte(aller, 'en') : 'first day' };
    var jR = { fr: retour ? D.jourTexte(retour, 'fr') : 'dernier jour', en: retour ? D.jourTexte(retour, 'en') : 'last day' };
    var mail = contact(fiche, /inscription/i, (fiche.streaming && fiche.streaming.contact) || 'inscriptions-festival@kadampafrance.org');
    return {
      titre: { fr: 'Navettes gare d\'Ecommoy ↔ CMK France', en: 'Shuttles Ecommoy station ↔ KMC France' },
      intro: {
        fr: 'Des navettes relient la gare d\'Ecommoy et le Centre de Méditation Kadampa France le ' + jA.fr + ' (arrivées) et le ' + jR.fr + ' (départs).\nIndiquez les horaires de vos trains : nous regroupons les participants par navette et nous vous confirmons l\'horaire.',
        en: 'Shuttles run between Ecommoy station and the Kadampa Meditation Centre France on ' + jA.en + ' (arrivals) and ' + jR.en + ' (departures).\nPlease give your train times: we group participants by shuttle and confirm your time with you.'
      },
      questions: [
        { id: 'email', type: 'email', requis: true, auto: 'email', label: { fr: 'E-mail', en: 'E-mail' }, aide: { fr: 'L\'adresse utilisée pour votre inscription.', en: 'The address used for your booking.' } },
        { id: 'prenom', type: 'texte', requis: true, auto: 'given-name', label: { fr: 'Prénom', en: 'First name' } },
        { id: 'nom', type: 'texte', requis: true, auto: 'family-name', label: { fr: 'Nom', en: 'Last name' } },
        { id: 'tel', type: 'tel', label: { fr: 'Téléphone portable', en: 'Mobile phone' }, aide: { fr: 'Facultatif : pour vous joindre le jour du trajet.', en: 'Optional: to reach you on the day of travel.' } },
        { id: 's_aller', type: 'section', label: { fr: 'Aller : ' + jA.fr, en: 'Arrival: ' + jA.en } },
        { id: 'aller_non', type: 'case', label: { fr: 'Je n\'ai pas besoin de la navette à l\'aller', en: 'I do not need the shuttle on arrival' } },
        { id: 'train_aller', type: 'texte', requis: true, condition: { q: 'aller_non', op: 'pasCoche' },
          label: { fr: 'Heure d\'arrivée de votre train en gare d\'Ecommoy, le ' + jA.fr, en: 'Arrival time of your train at Ecommoy station on ' + jA.en },
          aide: { fr: 'Exemple : 14h32', en: 'Example: 14:32' } },
        { id: 's_retour', type: 'section', label: { fr: 'Retour : ' + jR.fr, en: 'Departure: ' + jR.en } },
        { id: 'retour_non', type: 'case', label: { fr: 'Je n\'ai pas besoin de la navette au retour', en: 'I do not need the shuttle on departure' } },
        { id: 'train_retour', type: 'texte', requis: true, condition: { q: 'retour_non', op: 'pasCoche' },
          label: { fr: 'Heure de départ de votre train en gare d\'Ecommoy, le ' + jR.fr, en: 'Departure time of your train from Ecommoy station on ' + jR.en },
          aide: { fr: 'Exemple : 16h05', en: 'Example: 16:05' } },
        { id: 'commentaire', type: 'paragraphe', label: { fr: 'Commentaire', en: 'Comment' } }
      ],
      merci: { fr: 'Nous vous confirmerons l\'horaire de votre navette.', en: 'We will confirm your shuttle time with you.' },
      ferme: { fr: 'Les réservations de navettes sont closes.', en: 'Shuttle bookings are closed.' },
      rgpd: {
        fr: 'Vos réponses servent uniquement à organiser les navettes de l\'événement. Elles sont lues par l\'équipe d\'organisation du Centre de Méditation Kadampa France et supprimées après l\'événement. Pour les consulter, les corriger ou les faire supprimer : ' + mail + '.',
        en: 'Your answers are used only to organise the shuttles for the event. They are read by the organising team of the Kadampa Meditation Centre France and deleted after the event. To see, correct or delete them: ' + mail + '.'
      },
      contact: mail
    };
  };
})();
