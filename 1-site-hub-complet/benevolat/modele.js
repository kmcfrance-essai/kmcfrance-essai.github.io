/* =========================================================
   Modèle de départ du formulaire Bénévolat (séjour de bénévolat).
   Utilisé une seule fois par événement (« Partir du modèle » dans l'admin) :
   ensuite, tout se modifie dans l'admin, onglet Questions.
   Repris du formulaire Google « Séjour de bénévolat » de la Célébration
   du Dharma 2026 ; les jours d'arrivée sont calculés depuis la fiche
   (4, 3 et 2 jours avant le début de l'événement) : à ajuster dans l'admin.
   ========================================================= */
(function () {
  'use strict';
  var F = window.Formulaires, D = F.dates;
  function contact(fiche, re, defaut) {
    var c = (fiche.contacts || []).filter(function (x) { return x.email && re.test(x.role || ''); })[0];
    return c ? c.email : defaut;
  }
  var id = 0;
  function o(fr, en) { id++; return { id: 'o' + id, fr: fr, en: en }; }

  F.modeles = F.modeles || {};
  /* Version CD2026 (Célébration du Dharma 2026, en test en parallèle des Google Forms) :
     horaires, dates limites et textes propres à la Célébration. */
  var CD2026 = {
    "titre": {
      "fr": "Séjour de bénévolat",
      "en": "Volunteering stay"
    },
    "intro": {
      "fr": "Si participer à l'aventure de l'organisation de cet événement si spécial vous tente, nous serons très heureux de vous accueillir !\n\n**Séjour de bénévolat** (avant la Célébration) : 2 jours minimum (mercredi-jeudi), arrivée **au plus tard le mercredi 25 novembre à 9h**. L'hébergement et les repas sont remboursés.\n**Pendant la Célébration** (27-30 novembre) : tous les participants sont aussi bénévoles pour l'organisation générale.\n**Après la Célébration** : il est possible de rester jusqu'à 48 h après le lundi 30 novembre midi pour le rangement.",
      "en": "If you would like to take part in the adventure of organising this very special event, we will be very happy to welcome you!\n\n**Volunteering stay** (before the Celebration): 2 days minimum (Wednesday-Thursday), arrival **by Wednesday 25 November at 9:00 at the latest**. Accommodation and meals are refunded.\n**During the Celebration** (27-30 November): all participants also volunteer for the general organisation.\n**After the Celebration**: you can stay up to 48 hours after Monday 30 November noon to help tidy up."
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
        "id": "tel",
        "type": "tel",
        "requis": true,
        "auto": "tel",
        "label": {
          "fr": "Téléphone",
          "en": "Phone"
        }
      },
      {
        "id": "ville",
        "type": "texte",
        "requis": true,
        "auto": "address-level2",
        "label": {
          "fr": "Ville",
          "en": "Town / city"
        }
      },
      {
        "id": "genre",
        "type": "choix",
        "label": {
          "fr": "Genre",
          "en": "Gender"
        },
        "aide": {
          "fr": "Facultatif : pour la répartition des chambres et des dortoirs.",
          "en": "Optional: to allocate rooms and dormitories."
        },
        "options": [
          {
            "id": "o1",
            "fr": "Femme",
            "en": "Woman"
          },
          {
            "id": "o2",
            "fr": "Homme",
            "en": "Man"
          },
          {
            "id": "o3",
            "fr": "Je ne souhaite pas le préciser",
            "en": "I prefer not to say"
          }
        ]
      },
      {
        "id": "domaine",
        "type": "choix",
        "requis": true,
        "autre": true,
        "label": {
          "fr": "Domaine d'aide",
          "en": "Area of help"
        },
        "aide": {
          "fr": "Environ 6 h par jour ; une bonne condition physique est nécessaire.",
          "en": "About 6 hours a day; good physical condition is required."
        },
        "options": [
          {
            "id": "o4",
            "fr": "Là où il y a besoin",
            "en": "Wherever needed"
          },
          {
            "id": "o5",
            "fr": "Restauration",
            "en": "Kitchen & catering"
          },
          {
            "id": "o6",
            "fr": "Ménage - Hébergements",
            "en": "Cleaning - Accommodation"
          },
          {
            "id": "o7",
            "fr": "Manutention",
            "en": "Handling & setting up"
          }
        ]
      },
      {
        "id": "precisions",
        "type": "paragraphe",
        "label": {
          "fr": "Précisions",
          "en": "Details"
        },
        "aide": {
          "fr": "Compétences, préférences, contraintes…",
          "en": "Skills, preferences, constraints…"
        }
      },
      {
        "id": "commentaires",
        "type": "paragraphe",
        "label": {
          "fr": "Commentaires ou demandes",
          "en": "Comments or requests"
        }
      },
      {
        "id": "arrivee",
        "type": "jourheure",
        "requis": true,
        "label": {
          "fr": "Jour et heure d'arrivée",
          "en": "Day and time of arrival"
        },
        "aide": {
          "fr": "Arrivée au plus tard le mercredi 25 novembre à 9h.",
          "en": "Arrival on Wednesday 25 November at 9:00 at the latest."
        },
        "jours": [
          {
            "date": "2026-11-23",
            "de": "09:00",
            "a": "22:00"
          },
          {
            "date": "2026-11-24",
            "de": "09:00",
            "a": "22:00"
          },
          {
            "date": "2026-11-25",
            "de": "07:00",
            "a": "09:00"
          }
        ]
      },
      {
        "id": "navette",
        "type": "choix",
        "requis": true,
        "label": {
          "fr": "Avez-vous besoin d'une navette entre la gare et le centre ?",
          "en": "Do you need a shuttle between the station and the centre?"
        },
        "aide": {
          "fr": "Attention : les navettes régulières ne circulent que le vendredi 27 et le lundi 30 novembre. Nous vous recontacterons.",
          "en": "Please note: regular shuttles only run on Friday 27 and Monday 30 November. We will get back to you."
        },
        "options": [
          {
            "id": "o8",
            "fr": "Oui",
            "en": "Yes"
          },
          {
            "id": "o9",
            "fr": "Non",
            "en": "No"
          },
          {
            "id": "o10",
            "fr": "Je ne sais pas encore",
            "en": "I don't know yet"
          }
        ]
      },
      {
        "id": "train",
        "type": "choix",
        "label": {
          "fr": "Arrivez-vous en train ?",
          "en": "Are you arriving by train?"
        },
        "aide": {
          "fr": "Nous vous demanderons vos horaires plus tard.",
          "en": "We will ask for your train times later."
        },
        "options": [
          {
            "id": "o11",
            "fr": "Oui",
            "en": "Yes"
          },
          {
            "id": "o12",
            "fr": "Non",
            "en": "No"
          }
        ]
      }
    ],
    "merci": {
      "fr": "Merci pour votre aide ! L'équipe bénévolat revient vers vous pour organiser votre séjour.",
      "en": "Thank you for your help! The volunteering team will get back to you to organise your stay."
    },
    "ferme": {
      "fr": "Les inscriptions au séjour de bénévolat sont closes.",
      "en": "Registration for the volunteering stay is closed."
    },
    "rgpd": {
      "fr": "Vos réponses servent uniquement à organiser le bénévolat de la Célébration. Elles sont lues par l'équipe bénévolat du Centre de Méditation Kadampa France et supprimées après l'événement. Pour les consulter, les corriger ou les faire supprimer : benevolat-festival@kadampafrance.org.",
      "en": "Your answers are used only to organise volunteering for the Celebration. They are read by the volunteering team of the Kadampa Meditation Centre France and deleted after the event. To see, correct or delete them: benevolat-festival@kadampafrance.org."
    },
    "contact": "benevolat-festival@kadampafrance.org"
  };

  F.modeles.benevolat = function (fiche) {
    if (fiche.id === 'cd2026') return JSON.parse(JSON.stringify(CD2026));
    id = 0;
    var debut = D.dateValide(fiche.debut) ? fiche.debut : '';
    var jours = debut ? [
      { date: D.decalerJour(debut, -4), de: '09:00', a: '21:00' },
      { date: D.decalerJour(debut, -3), de: '09:00', a: '21:00' },
      { date: D.decalerJour(debut, -2), de: '07:00', a: '09:00' }
    ] : [];
    var limite = debut ? D.decalerJour(debut, -2) : '';
    var mail = contact(fiche, /b[ée]n[ée]volat/i, 'benevolat-festival@kadampafrance.org');
    return {
      titre: { fr: 'Séjour de bénévolat', en: 'Volunteering stay' },
      intro: {
        fr: 'Si participer à l\'aventure de l\'organisation de cet événement si spécial vous tente, nous serons très heureux de vous accueillir !\n\n' +
          '**Séjour de bénévolat** : avant l\'événement, 2 jours minimum. L\'hébergement et les repas sont remboursés.\n' +
          '**Pendant l\'événement** : tous les participants sont aussi bénévoles pour l\'organisation générale.',
        en: 'If you would like to take part in the adventure of organising this very special event, we will be very happy to welcome you!\n\n' +
          '**Volunteering stay**: before the event, 2 days minimum. Accommodation and meals are refunded.\n' +
          '**During the event**: all participants also volunteer for the general organisation.'
      },
      questions: [
        { id: 'email', type: 'email', requis: true, auto: 'email', label: { fr: 'E-mail', en: 'E-mail' } },
        { id: 'nom', type: 'texte', requis: true, auto: 'family-name', label: { fr: 'Nom', en: 'Last name' } },
        { id: 'prenom', type: 'texte', requis: true, auto: 'given-name', label: { fr: 'Prénom', en: 'First name' } },
        { id: 'tel', type: 'tel', requis: true, auto: 'tel', label: { fr: 'Téléphone', en: 'Phone' } },
        { id: 'ville', type: 'texte', requis: true, auto: 'address-level2', label: { fr: 'Ville', en: 'Town / city' } },
        { id: 'genre', type: 'choix', label: { fr: 'Genre', en: 'Gender' },
          aide: { fr: 'Facultatif : pour la répartition des chambres et des dortoirs.', en: 'Optional: to allocate rooms and dormitories.' },
          options: [o('Femme', 'Woman'), o('Homme', 'Man'), o('Je ne souhaite pas le préciser', 'I prefer not to say')] },
        { id: 'domaine', type: 'choix', requis: true, autre: true, label: { fr: 'Domaine d\'aide', en: 'Area of help' },
          aide: { fr: 'Environ 6 h par jour ; une bonne condition physique est nécessaire.', en: 'About 6 hours a day; good physical condition is required.' },
          options: [o('Là où il y a besoin', 'Wherever needed'), o('Restauration', 'Kitchen & catering'), o('Ménage - Hébergements', 'Cleaning - Accommodation'), o('Manutention', 'Handling & setting up')] },
        { id: 'precisions', type: 'paragraphe', label: { fr: 'Précisions', en: 'Details' }, aide: { fr: 'Compétences, préférences, contraintes…', en: 'Skills, preferences, constraints…' } },
        { id: 'commentaires', type: 'paragraphe', label: { fr: 'Commentaires ou demandes', en: 'Comments or requests' } },
        { id: 'arrivee', type: 'jourheure', requis: true, label: { fr: 'Jour et heure d\'arrivée', en: 'Day and time of arrival' },
          aide: limite ? { fr: 'Arrivée au plus tard le ' + D.jourTexte(limite, 'fr') + ' à 9h.', en: 'Arrival on ' + D.jourTexte(limite, 'en') + ' at 9:00 at the latest.' } : undefined,
          jours: jours },
        { id: 'navette', type: 'choix', requis: true, label: { fr: 'Avez-vous besoin d\'une navette entre la gare et le centre ?', en: 'Do you need a shuttle between the station and the centre?' },
          options: [o('Oui', 'Yes'), o('Non', 'No'), o('Je ne sais pas encore', 'I don\'t know yet')] },
        { id: 'train', type: 'choix', label: { fr: 'Arrivez-vous en train ?', en: 'Are you arriving by train?' },
          aide: { fr: 'Nous vous demanderons vos horaires plus tard.', en: 'We will ask for your train times later.' },
          options: [o('Oui', 'Yes'), o('Non', 'No')] }
      ],
      merci: { fr: 'Merci pour votre aide ! L\'équipe bénévolat revient vers vous pour organiser votre séjour.', en: 'Thank you for your help! The volunteering team will get back to you to organise your stay.' },
      ferme: { fr: 'Les inscriptions au séjour de bénévolat sont closes.', en: 'Registration for the volunteering stay is closed.' },
      rgpd: {
        fr: 'Vos réponses servent uniquement à organiser le bénévolat de l\'événement. Elles sont lues par l\'équipe bénévolat du Centre de Méditation Kadampa France et supprimées après l\'événement. Pour les consulter, les corriger ou les faire supprimer : ' + mail + '.',
        en: 'Your answers are used only to organise volunteering for the event. They are read by the volunteering team of the Kadampa Meditation Centre France and deleted after the event. To see, correct or delete them: ' + mail + '.'
      },
      contact: mail
    };
  };
})();
