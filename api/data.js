/* GET /api/data — état complet du panel (référentiels + sessions + inscriptions) */
const { queryAll, P, DB, handler } = require("./_notion");

const mn = t => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + m; };
const heure = iso => (iso && iso.includes("T") ? iso.slice(11, 16) : "");
const jour  = iso => (iso || "").slice(0, 10);

module.exports = handler(async (req, res) => {
  const [
    sessionsR, creneauxR, participantsR, apprenantsR,
    formationsR, entreprisesR, collabsR, financeursR,
    contactsR, documentsR, echangesR, veilleR, ameliorationsR, competencesR, organismeR, emargementsR, abandonsR, modelesR,
  ] = await Promise.all([
    queryAll(DB.sessions),
    queryAll(DB.creneaux),
    queryAll(DB.participants),
    queryAll(DB.apprenants),
    queryAll(DB.formations),
    queryAll(DB.entreprises),
    queryAll(DB.collaborateurs),
    queryAll(DB.financeurs),
    queryAll(DB.contacts).catch(() => []),
    queryAll(DB.documents).catch(() => []),
    queryAll(DB.interactions).catch(() => []),
    queryAll(DB.veille).catch(() => []),
    queryAll(DB.ameliorations).catch(() => []),
    queryAll(DB.competences).catch(() => []),
    queryAll(DB.organisme).catch(() => []),
    queryAll(DB.emargements).catch(() => []),
    queryAll(DB.abandons).catch(() => []),
    queryAll(DB.modeles).catch(() => []),
  ]);

  const id = p => p.id.replace(/-/g, "");

  /* ── Référentiels ── */
  const formations = formationsR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      nom: P.title(x, "Nom de la formation"),
      code: P.text(x, "Code formation"),
      duree: P.num(x, "Durée (heures)") ?? 0,
      jours: P.num(x, "Durée (jours)") ?? 0,
      tarif: P.num(x, "Tarif HT intra") ?? 0,
      tarifInter: P.num(x, "Tarif HT inter"),
      modalite: P.select(x, "Modalités"),
      statutPub: P.select(x, "Statut publication"),
      slug: P.text(x, "slug"),
      tags: P.multi(x, "Tags"),
      programme: P.files(x, "Programme PDF").length > 0,
      supports: P.files(x, "Support participant").length + P.files(x, "Support formateur").length,
      typeTarif: P.select(x, "Type de tarif") || "€ HT",
      categorie: P.select(x, "Catégorie"),
      accroche: P.text(x, "Accroche"),
      objectif: P.text(x, "Objectif professionnel"),
      objectifsOp: P.text(x, "Objectifs opérationnels"),
      publicCible: P.text(x, "Public cible"),
      prerequis: P.text(x, "Prérequis"),
      delais: P.text(x, "Délais d'accès"),
      nsf: P.text(x, "Code NSF"),
      nature: P.select(x, "Nature de l action") || "Action de formation",
      accessibilite: P.text(x, "Accessibilité handicap"),
      sanction: P.text(x, "Sanction de la formation"),
      contenu: P.text(x, "Contenu de formation"),
      evalDesc: P.text(x, "Évaluations formatives (description)"),
      evalModalites: P.text(x, "Modalités d évaluation"),
      titreSeo: P.text(x, "Titre SEO"),
      metaDesc: P.text(x, "Méta-description"),
      image: P.text(x, "Image (fichier)"),
      motsCles: P.text(x, "Mots-clés (recherche)"),
      pointsForts: P.text(x, "Points forts"),
      moyens: {
        modalites: P.text(x, "Modalités pédagogiques"),
        methodes: P.text(x, "Méthodes pédagogiques"),
        ressources: P.text(x, "Ressources pédagogiques (texte)"),
        profil: P.text(x, "Profil de l intervenant"),
      },
      technique: {
        locaux: P.text(x, "Locaux (description)"),
        locauxPar: P.multi(x, "Locaux mis à disposition par"),
        equip: P.text(x, "Équipements (description)"),
        equipPar: P.multi(x, "Équipements mis à disposition par"),
      },
      files: {
        programme: P.files(x, "Programme PDF")[0]?.nom || null,
        deroulePdf: P.files(x, "Déroulé pédagogique (fichier)")[0]?.nom || null,
        supportPart: P.files(x, "Support participant")[0]?.nom || null,
        supportForm: P.files(x, "Support formateur")[0]?.nom || null,
      },
      /* URL signées par Notion, valables environ une heure : elles permettent
         le téléchargement direct depuis le panel. */
      urls: {
        programme: P.files(x, "Programme PDF")[0]?.url || "",
        deroulePdf: P.files(x, "Déroulé pédagogique (fichier)")[0]?.url || "",
        supportPart: P.files(x, "Support participant")[0]?.url || "",
        supportForm: P.files(x, "Support formateur")[0]?.url || "",
      },
      formateurs: P.rel(x, "👩‍🏫 Formateurs qualifiés"),
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom));

  const clients = entreprisesR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      nom: P.title(x, "Nom"),
      type: P.select(x, "Type") || "Entreprise",
      statut: P.select(x, "Statut") || "Prospect",
      siret: P.text(x, "SIRET"),
      email: P.email(x, "Email"),
      tel: P.phone(x, "Téléphone"),
      adresse: P.text(x, "Adresse"),
      cp: P.text(x, "Code postal"),
      ville: P.text(x, "Ville"),
      formeJuridique: P.select(x, "Forme juridique"),
      secteur: P.select(x, "Secteur d'activité"),
      cadrage: P.text(x, "Cadrage formation"),
      notes: P.text(x, "Notes internes"),
      contacts: [], docs: [], echanges: [],
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom));

  const parClient = id => clients.find(c => c.id === id);

  contactsR.forEach(p => {
    const x = p.properties;
    const cid = P.rel1(x, "Entreprise");
    const c = parClient(cid);
    if (!c) return;
    c.contacts.push({
      id: id(p),
      nom: P.title(x, "Nom"),
      prenom: P.text(x, "Prénom"),
      civilite: P.select(x, "Civilité"),
      fonction: P.text(x, "Fonction"),
      email: P.email(x, "Email"),
      tel: P.phone(x, "Téléphone"),
      linkedin: P.url(x, "LinkedIn"),
      principal: P.check(x, "Contact principal"),
      repLegal: P.check(x, "Représentant légal"),
    });
  });

  documentsR.forEach(p => {
    const x = p.properties;
    const c = parClient(P.rel1(x, "Entreprise"));
    if (!c) return;
    c.docs.push({
      id: id(p),
      titre: P.title(x, "Titre"),
      type: P.select(x, "Type") || "Devis",
      statut: P.select(x, "Statut") || "Brouillon",
      envoi: P.date(x, "Date d envoi"),
      signature: P.date(x, "Date de signature"),
      montant: P.num(x, "Montant HT"),
      signataire: P.text(x, "Signataire côté client"),
      sessionId: P.rel1(x, "Session"),
      fichier: P.files(x, "Fichier")[0]?.nom || null,
    });
  });

  echangesR.forEach(p => {
    const x = p.properties;
    const c = parClient(P.rel1(x, "Entreprise"));
    if (!c) return;
    c.echanges.push({
      id: id(p),
      titre: P.title(x, "Titre"),
      type: P.select(x, "Type") || "Appel",
      date: P.date(x, "Date"),
      cr: P.text(x, "Compte rendu"),
      suite: P.text(x, "Prochaine action"),
    });
  });

  const formateurs = collabsR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      nom: P.title(x, "Nom"),
      prenom: P.text(x, "Prénom"),
      fonction: P.text(x, "Fonction"),
      statut: P.select(x, "Statut") || "Salarié",
      type: P.select(x, "Type d intervenant") || "Interne",
      email: P.email(x, "Email"),
      tel: P.phone(x, "Téléphone"),
      actif: P.check(x, "Actif"),
      notes: P.text(x, "Notes"),
      domaines: P.multi(x, "Domaines d intervention"),
      refPeda: P.check(x, "Référent pédagogique"),
      refAdmin: P.check(x, "Référent administratif"),
      refHandicap: P.check(x, "Référent handicap"),
      formations: P.rel(x, "📚 Formations habilitées"),
      entree: P.date(x, "Date d entrée"),
      sortie: P.date(x, "Date de sortie"),
      suivis: [],
      docs: {
        cv:     P.files(x, "CV")[0]?.nom || null,
        dip:    P.files(x, "Diplômes et certifications")[0]?.nom || null,
        attest: P.files(x, "Attestations & certificats")[0]?.nom || null,
        nda:    P.files(x, "NDA")[0]?.nom || null,
        rc:     P.files(x, "RC Pro")[0]?.nom || null,
        kbis:   P.files(x, "Kbis / justificatif d immatriculation")[0]?.nom || null,
        urssaf: P.files(x, "Attestation de vigilance URSSAF")[0]?.nom || null,
        fiscal: P.files(x, "Attestation régularité fiscale")[0]?.nom || null,
        contrat:P.files(x, "Contrat de sous-traitance")[0]?.nom || null,
        confid: P.files(x, "Engagement de confidentialité")[0]?.nom || null,
        autres: P.files(x, "Autres documents")[0]?.nom || null,
      },
    };
  });

  competencesR.forEach(p => {
    const x = p.properties;
    const t = formateurs.find(f => f.id === P.rel1(x, "Intervenant"));
    if (!t) return;
    t.suivis.push({
      id: id(p),
      titre: P.title(x, "Intitulé"),
      type: P.select(x, "Type") || "Formation suivie",
      date: P.date(x, "Date"),
      organisme: P.text(x, "Organisme ou source"),
      duree: P.num(x, "Durée (heures)"),
      competences: P.text(x, "Compétences visées"),
      suites: P.text(x, "Suites données"),
      preuve: P.files(x, "Preuve")[0]?.nom || null,
    });
  });

  const financeurs = financeursR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      nom: P.title(x, "Nom du financeur"),
      type: P.select(x, "Type") || "OPCO",
      email: P.email(x, "Email"),
      tel: P.phone(x, "Téléphone"),
      adresse: P.text(x, "Adresse"),
      cp: P.text(x, "Code postal"),
      ville: P.text(x, "Ville"),
      site: P.url(x, "Site web"),
      portail: P.url(x, "Espace de dépôt en ligne"),
      contact: P.text(x, "Contact référent"),
      numero: P.text(x, "Numéro d adhérent / de compte"),
      conditions: P.text(x, "Conditions de prise en charge"),
      delai: P.num(x, "Délai de dépôt (jours avant formation)"),
      actif: P.check(x, "Actif"),
      notes: P.text(x, "Notes internes"),
      docs: P.files(x, "Documents").map((f, i) => ({ id: "fd" + i, titre: f.nom, fichier: f.nom, date: "" })),
    };
  });

  const apprenants = apprenantsR.map(p => {
    const x = p.properties;
    const entId = P.rel1(x, "Entreprise");
    return {
      id: id(p),
      nom: P.text(x, "Nom") || P.title(x, "Nom complet"),
      prenom: P.text(x, "Prénom"),
      email: P.email(x, "Email"),
      tel: P.phone(x, "Téléphone"),
      fonction: P.text(x, "Fonction"),
      entrepriseId: entId,
      entreprise: clients.find(c => c.id === entId)?.nom || "",
      notes: P.text(x, "Notes"),
      inscriptions: P.rel(x, "👥 Inscriptions"),
    };
  }).sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

  /* ── Créneaux groupés par session ── */
  const creneauxParSession = {};
  creneauxR.forEach(p => {
    const x = p.properties;
    const sid = P.rel1(x, "Session");
    if (!sid) return;
    const deb = P.date(x, "Début"), fin = P.date(x, "Fin");
    (creneauxParSession[sid] ||= []).push({
      id: id(p),
      date: jour(deb),
      type: P.select(x, "Type") || "Matin",
      d: heure(deb) || "09:00",
      f: heure(fin) || "12:30",
      ordre: P.num(x, "Ordre") ?? 0,
    });
  });
  Object.values(creneauxParSession).forEach(list =>
    list.sort((a, b) => (a.ordre - b.ordre) || a.date.localeCompare(b.date) || mn(a.d) - mn(b.d)));

  /* ── Signatures d'émargement, indexées par session ── */
  const signatures = {};   /* sessionId → { participantId|"formateur" → Set(numéros de créneau) }
                              La correspondance se fait sur le numéro de créneau, ou à défaut
                              sur le libellé (« J1 - Matin »). */
  emargementsR.forEach(p => {
    const x = p.properties;
    if (!P.check(x, "Signé")) return;
    const sid = P.rel1(x, "Session");
    if (!sid) return;
    const partId = P.rel1(x, "Participant");
    const formId = P.rel1(x, "Formateur");
    const signataire = P.select(x, "Signataire");
    const cle = (signataire === "Formateur" || (!partId && formId)) ? "formateur" : partId;
    if (!cle) return;
    const num = P.num(x, "Numéro créneau");
    const libelle = P.text(x, "Créneau");
    ((signatures[sid] ||= {})[cle] ||= { nums: new Set(), libelles: new Set() });
    if (num) signatures[sid][cle].nums.add(num);
    if (libelle) signatures[sid][cle].libelles.add(libelle.trim().toLowerCase());
  });

  const aSigne = (sid, cle, index, creneau) => {
    const s = signatures[sid]?.[cle];
    if (!s) return false;
    if (s.nums.has(index + 1)) return true;
    const j = creneau ? `${creneau.type}` : "";
    return [...s.libelles].some(l => l.includes(String(index + 1)) && l.includes(j.toLowerCase().slice(0, 4)));
  };

  /* ── Inscriptions (base Participants) groupées par session ── */
  const inscritsParSession = {};
  participantsR.forEach(p => {
    const x = p.properties;
    const sid = P.rel1(x, "📅 Sessions");
    if (!sid) return;
    const aId = P.rel1(x, "🎓 Apprenant");
    (inscritsParSession[sid] ||= []).push({
      id: id(p),
      aId,
      nomBrut: P.title(x, "Nom complet"),
      prenomBrut: P.text(x, "Prénom"),
      pos: P.check(x, "Positionnement complété"),
      ev: P.check(x, "Évaluation complétée") ? 1 : null,
      sat: P.check(x, "Satisfaction complétée"),
      froid: P.check(x, "Éval à froid complétée"),
      emComplets: P.check(x, "Émargements complets"),
      convoc: P.check(x, "Convocation envoyée"),
      convocDate: P.date(x, "Date d'envoi de la convocation"),
      mode: P.select(x, "Mode d'inscription"),
      financement: P.select(x, "Mode de financement"),
      financeurId: P.rel1(x, "💶 Financeur"),
      montant: P.num(x, "Montant pris en charge"),
      attestation: P.check(x, "Attestation remise"),
      adaptation: P.check(x, "Besoin d'adaptation à signaler"),
      besoin: P.text(x, "Besoin d'adaptation spécifique de la formation? "),
      mesures: P.text(x, "Mesures adaptées mises en place"),
      lienEspace: P.formula(x, "Lien espace stagiaire") || "",
      liens: {
        espace: P.formula(x, "Lien espace stagiaire") || "",
        positionnement: P.formula(x, "Lien positionnement") || "",
        emargement: P.formula(x, "Lien émargement") || "",
        evaluation: P.formula(x, "Lien évaluation") || "",
        satisfaction: P.formula(x, "Lien satisfaction") || "",
        froid: P.formula(x, "Lien éval à froid") || "",
      },
    });
  });

  /* ── Sessions ── */
  const sessions = sessionsR.map(p => {
    const x = p.properties;
    const sid = id(p);
    const creneaux = creneauxParSession[sid] || [];
    const inscrits = (inscritsParSession[sid] || []).map(i => ({
      ...i,
      em: creneaux.map((c, ix) => aSigne(sid, i.id, ix, c) || i.emComplets),
    }));
    const emF = creneaux.map((c, ix) => aSigne(sid, "formateur", ix, c));
    return {
      id: sid,
      titre: P.title(x, "Titre formation"),
      code: P.text(x, "Code session"),
      formationId: P.rel1(x, "Formation"),
      clientId: P.rel1(x, "Entreprise"),
      formateurId: P.rel1(x, "👩‍🏫 Formateur·rice"),
      financeurId: P.rel1(x, "💶 Financeur"),
      type: P.select(x, "Type") || "INTRA",
      modalite: P.select(x, "Modalité") || "Présentiel",
      modalites: [P.select(x, "Modalité") || "Présentiel"],
      statut: P.select(x, "Statut") || "Planifiée",
      lieu: P.text(x, "Lieu"),
      adresse: P.text(x, "Adresse complète"),
      /* Les dates viennent des créneaux, seule source de vérité. Les rollups Notion
         « Première / Dernière demi-journée » donnent la même chose côté base. */
      dateDebut: creneaux[0]?.date || "",
      dateFin: creneaux.length ? creneaux[creneaux.length - 1].date : "",
      convention: P.files(x, "Convention signée").length > 0,
      conventionFichier: P.files(x, "Convention signée")[0]?.nom || null,
      conventionUrl: P.files(x, "Convention signée")[0]?.url || "",
      convocation: P.check(x, "Convocation envoyée"),
      besoin: {
        contexte: P.text(x, "Analyse du besoin — contexte"),
        objectifs: P.text(x, "Objectifs attendus par le client"),
        contraintes: P.text(x, "Contraintes et adaptations"),
      },
      rapport: {
        fait: P.check(x, "Rapport complété"),
        deroule: P.text(x, "Rapport: déroulé & adaptations"),
        forts: P.text(x, "Rapport: points forts"),
        diff: P.text(x, "Rapport: difficultés & solutions"),
        axes: P.text(x, "Rapport: axes d'amélioration"),
      },
      notes: P.text(x, "Notes internes"),
      lienFormateur: P.formula(x, "Lien émargement formateur") || "",
      creneaux,
      inscrits,
      emF,
    };
  }).sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || ""));

  /* ── Veille ── */
  const THEME_INVERSE = {
    "Légale & réglementaire (Ind.23)": "legale",
    "Métiers & compétences (Ind.24)": "metiers",
    "Pédagogique & techno (Ind.25)": "pedago",
    "Handicap (Ind.26)": "handicap",
  };
  const veilles = veilleR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      titre: P.title(x, "Élément de veille"),
      theme: THEME_INVERSE[P.select(x, "Type")] || "legale",
      date: P.date(x, "Date"),
      source: P.text(x, "Source"),
      description: P.text(x, "Description"),
      exploitation: P.text(x, "Exploitation et actions mises en œuvre"),
      responsable: P.text(x, "Responsable"),
      echeance: P.date(x, "Échéance"),
      statut: P.select(x, "Statut de l action") || "À traiter",
      formationId: P.rel1(x, "Formation concernée"),
      preuves: P.files(x, "Preuves / sources").length,
      preuvesEx: P.files(x, "Preuves d exploitation").length,
    };
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  /* ── Amélioration continue ── */
  const ameliorations = ameliorationsR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      objet: P.title(x, "Action"),
      type: P.select(x, "Type d action") || "Autre",
      date: P.date(x, "Date de réception ou de détection"),
      cloture: P.date(x, "Date de clôture"),
      situation: P.text(x, "Constat"),
      action: P.text(x, "Action décidée"),
      impact: P.select(x, "Impact") || "Mineur",
      statut: P.select(x, "Statut") || "À traiter",
      signalePar: P.select(x, "Signalé par"),
      parties: P.text(x, "Parties prenantes"),
      echeance: P.date(x, "Échéance de traitement"),
      responsable: P.text(x, "Responsable"),
      source: P.select(x, "Source"),
      reponse: P.text(x, "Réponse apportée"),
      verification: P.text(x, "Vérification efficacité"),
      accuse: P.date(x, "Date d accusé de réception"),
      dateReponse: P.date(x, "Date de réponse"),
      sessionId: P.rel1(x, "Session concernée"),
      participantId: P.rel1(x, "Participant"),
      veilleId: P.rel1(x, "📡 Veille à l origine"),
      abandonId: P.rel1(x, "Abandon lié"),
    };
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  /* ── Abandons et ruptures de parcours ── */
  const abandons = abandonsR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      identifiant: P.title(x, "Identifiant"),
      participantId: P.rel1(x, "Participant"),
      sessionId: P.rel1(x, "Session"),
      dateAbandon: P.date(x, "Date abandon"),
      stade: P.select(x, "Stade"),
      motif: P.select(x, "Motif"),
      motifDetail: P.text(x, "Motif détaillé"),
      origine: P.select(x, "Origine de la décision"),
      solution: P.select(x, "Solution proposée"),
      consequence: P.select(x, "Conséquence"),
      contact: P.check(x, "Contact réalisé"),
      dateSuivi: P.date(x, "Date du suivi"),
      commentaires: P.text(x, "Commentaires"),
      actionCreee: P.check(x, "Action amélioration créée"),
    };
  }).sort((a, b) => (b.dateAbandon || "").localeCompare(a.dateAbandon || ""));

  /* ── Fiche organisme (ligne unique) ── */
  const o = organismeR[0]?.properties || {};
  const org = {
    id: organismeR[0] ? id(organismeR[0]) : "",
    nom: P.title(o, "Nom de l organisme"),
    forme: P.select(o, "Forme juridique"),
    siret: P.text(o, "SIRET"),
    siren: P.text(o, "SIREN"),
    nda: P.text(o, "NDA — numéro de déclaration d activité"),
    ndaPrefet: P.text(o, "NDA délivré par le Préfet de Région"),
    ape: P.text(o, "Code APE"),
    capital: P.num(o, "Capital social (€)"),
    tva: P.text(o, "TVA intracommunautaire"),
    rcs: P.text(o, "Ville du RCS"),
    email: P.email(o, "Email de contact"),
    tel: P.phone(o, "Téléphone"),
    adresse: P.text(o, "Adresse"),
    cp: P.text(o, "Code postal"),
    ville: P.text(o, "Ville"),
    region: P.text(o, "Région"),
    site: P.url(o, "Site web"),
    repNom: P.text(o, "Représentant légal"),
    repQualite: P.text(o, "Qualité du représentant"),
    qualiopi: P.check(o, "Certifié Qualiopi"),
    qualiopiDate: P.date(o, "Date d obtention Qualiopi"),
    modalitesAcces: P.text(o, "Modalités d accès"),
    delaisAcces: P.text(o, "Délais d accès"),
    implication: P.text(o, "Méthodes d implication des bénéficiaires"),
    secteurs: P.text(o, "Secteurs d intervention"),
    validiteDevis: P.num(o, "Validité des devis (jours)"),
    delaiConvoc: P.num(o, "Délai d envoi des convocations (jours)"),
    juridiction: P.text(o, "Juridiction compétente"),
    couleur: P.text(o, "Couleur de marque"),
    docs: {
      ri: P.files(o, "Règlement intérieur")[0]?.nom || null,
      cgv: P.files(o, "Conditions générales de vente")[0]?.nom || null,
      certif: P.files(o, "Certificat Qualiopi")[0]?.nom || null,
      logo: P.files(o, "Logo")[0]?.nom || null,
    },
    autres: P.files(o, "Documents administratifs").map(f => f.nom),
  };

  /* ── Modèles de documents ── */
  const modeles = modelesR.map(p => {
    const x = p.properties;
    return {
      id: id(p),
      nom: P.title(x, "Nom du modèle"),
      type: P.select(x, "Type") || "Autre",
      nature: P.select(x, "Nature") || "Modèle à fusionner",
      indicateur: P.text(x, "Indicateur"),
      variables: P.text(x, "Variables utilisées"),
      version: P.text(x, "Version"),
      maj: P.date(x, "Dernière mise à jour"),
      statut: P.select(x, "Statut") || "Brouillon",
      envoiPar: P.select(x, "Envoyé par"),
      notes: P.text(x, "Notes"),
      pdf: P.files(x, "PDF de référence")[0]?.nom || null,
      url: p.url || "",
    };
  }).sort((a, b) => a.type.localeCompare(b.type) || a.nom.localeCompare(b.nom));

  res.status(200).json({
    ok: true,
    charge: new Date().toISOString(),
    formations, clients, formateurs, financeurs, apprenants, sessions,
    veilles, ameliorations, org, abandons, modeles,
  });
});
