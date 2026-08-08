/* GET /api/data — état complet du panel (référentiels + sessions + inscriptions) */
const { queryAll, P, DB, handler } = require("./_notion");

const mn = t => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + m; };
const heure = iso => (iso && iso.includes("T") ? iso.slice(11, 16) : "");
const jour  = iso => (iso || "").slice(0, 10);

module.exports = handler(async (req, res) => {
  const [
    sessionsR, creneauxR, participantsR, apprenantsR,
    formationsR, entreprisesR, collabsR, financeursR,
  ] = await Promise.all([
    queryAll(DB.sessions),
    queryAll(DB.creneaux),
    queryAll(DB.participants),
    queryAll(DB.apprenants),
    queryAll(DB.formations),
    queryAll(DB.entreprises),
    queryAll(DB.collaborateurs),
    queryAll(DB.financeurs),
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
      objectif: P.text(x, "Objectif professionnel"),
      publicCible: P.text(x, "Public cible"),
      prerequis: P.text(x, "Prérequis"),
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
      em: creneaux.map(() => i.emComplets),
    }));
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
      dateDebut: P.date(x, "Date début"),
      dateFin: P.date(x, "Date fin"),
      convention: P.files(x, "Convention signée").length > 0,
      conventionFichier: P.files(x, "Convention signée")[0]?.nom || null,
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
      creneaux,
      inscrits,
      emF: creneaux.map(() => false),
    };
  }).sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || ""));

  res.status(200).json({
    ok: true,
    charge: new Date().toISOString(),
    formations, clients, formateurs, financeurs, apprenants, sessions,
  });
});
