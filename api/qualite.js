/* POST /api/qualite — 📡 Journal de veille, 🔄 Amélioration continue, 🏛️ Mon organisme */
const { notion, queryAll, P, W, DB, handler, readBody } = require("./_notion");

/* Thématiques de veille : clé de l'interface → valeur du champ Type dans Notion */
const THEMES = {
  legale:  "Légale & réglementaire (Ind.23)",
  metiers: "Métiers & compétences (Ind.24)",
  pedago:  "Pédagogique & techno (Ind.25)",
  handicap:"Handicap (Ind.26)",
};
const THEME_INVERSE = Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [v, k]));

const MAP = {
  veille: {
    titre:       v => ({ "Élément de veille": W.title(v) }),
    theme:       v => ({ "Type": W.select(THEMES[v] || v) }),
    date:        v => ({ "Date": W.date(v) }),
    source:      v => ({ "Source": W.text(v) }),
    desc:        v => ({ "Description": W.text(v) }),
    explo:       v => ({ "Exploitation et actions mises en œuvre": W.text(v) }),
    responsable: v => ({ "Responsable": W.text(v) }),
    echeance:    v => ({ "Échéance": W.date(v) }),
    statut:      v => ({ "Statut de l action": W.select(v) }),
    formationId: v => ({ "Formation concernée": W.rel(v ? [v] : []) }),
    impact:      v => ({ "Impact sur l'offre": W.select(v) }),
  },
  amelioration: {
    objet:       v => ({ "Action": W.title(v) }),
    type:        v => ({ "Type d action": W.select(v) }),
    date:        v => ({ "Date de réception ou de détection": W.date(v) }),
    cloture:     v => ({ "Date de clôture": W.date(v) }),
    situation:   v => ({ "Constat": W.text(v) }),
    action:      v => ({ "Action décidée": W.text(v) }),
    impact:      v => ({ "Impact": W.select(v) }),
    statut:      v => ({ "Statut": W.select(v) }),
    signalePar:  v => ({ "Signalé par": W.select(v) }),
    parties:     v => ({ "Parties prenantes": W.text(v) }),
    echeance:    v => ({ "Échéance de traitement": W.date(v) }),
    responsable: v => ({ "Responsable": W.text(v) }),
    source:      v => ({ "Source": W.select(v) }),
    accuse:      v => ({ "Date d accusé de réception": W.date(v) }),
    dateReponse: v => ({ "Date de réponse": W.date(v) }),
    reponse:     v => ({ "Réponse apportée": W.text(v) }),
    verification:v => ({ "Vérification efficacité": W.text(v) }),
    sessionId:   v => ({ "Session concernée": W.rel(v ? [v] : []) }),
    participantId: v => ({ "Participant": W.rel(v ? [v] : []) }),
    veilleId:    v => ({ "📡 Veille à l origine": W.rel(v ? [v] : []) }),
    abandonId:   v => ({ "Abandon lié": W.rel(v ? [v] : []) }),
  },
  abandon: {
    identifiant:  v => ({ "Identifiant": W.title(v) }),
    participantId:v => ({ "Participant": W.rel(v ? [v] : []) }),
    sessionId:    v => ({ "Session": W.rel(v ? [v] : []) }),
    dateAbandon:  v => ({ "Date abandon": W.date(v) }),
    stade:        v => ({ "Stade": W.select(v) }),
    motif:        v => ({ "Motif": W.select(v) }),
    motifDetail:  v => ({ "Motif détaillé": W.text(v) }),
    origine:      v => ({ "Origine de la décision": W.select(v) }),
    solution:     v => ({ "Solution proposée": W.select(v) }),
    consequence:  v => ({ "Conséquence": W.select(v) }),
    contact:      v => ({ "Contact réalisé": W.check(v) }),
    dateSuivi:    v => ({ "Date du suivi": W.date(v) }),
    commentaires: v => ({ "Commentaires": W.text(v) }),
    actionCreee:  v => ({ "Action amélioration créée": W.check(v) }),
  },
  modele: {
    nom:        v => ({ "Nom du modèle": W.title(v) }),
    type:       v => ({ "Type": W.select(v) }),
    nature:     v => ({ "Nature": W.select(v) }),
    indicateur: v => ({ "Indicateur": W.text(v) }),
    variables:  v => ({ "Variables utilisées": W.text(v) }),
    version:    v => ({ "Version": W.text(v) }),
    maj:        v => ({ "Dernière mise à jour": W.date(v) }),
    statut:     v => ({ "Statut": W.select(v) }),
    envoiPar:   v => ({ "Envoyé par": W.select(v) }),
    notes:      v => ({ "Notes": W.text(v) }),
  },
  organisme: {
    nom:      v => ({ "Nom de l organisme": W.title(v) }),
    forme:    v => ({ "Forme juridique": W.select(v) }),
    siret:    v => ({ "SIRET": W.text(v) }),
    siren:    v => ({ "SIREN": W.text(v) }),
    nda:      v => ({ "NDA — numéro de déclaration d activité": W.text(v) }),
    ndaPrefet:v => ({ "NDA délivré par le Préfet de Région": W.text(v) }),
    ape:      v => ({ "Code APE": W.text(v) }),
    capital:  v => ({ "Capital social (€)": W.num(v) }),
    tva:      v => ({ "TVA intracommunautaire": W.text(v) }),
    rcs:      v => ({ "Ville du RCS": W.text(v) }),
    email:    v => ({ "Email de contact": W.email(v) }),
    tel:      v => ({ "Téléphone": W.phone(v) }),
    adresse:  v => ({ "Adresse": W.text(v) }),
    cp:       v => ({ "Code postal": W.text(v) }),
    ville:    v => ({ "Ville": W.text(v) }),
    region:   v => ({ "Région": W.text(v) }),
    site:     v => ({ "Site web": W.url(v) }),
    repNom:   v => ({ "Représentant légal": W.text(v) }),
    repQualite: v => ({ "Qualité du représentant": W.text(v) }),
    qualiopi: v => ({ "Certifié Qualiopi": W.check(v) }),
    qualiopiDate: v => ({ "Date d obtention Qualiopi": W.date(v) }),
    modalitesAcces: v => ({ "Modalités d accès": W.text(v) }),
    delaisAcces:    v => ({ "Délais d accès": W.text(v) }),
    implication:    v => ({ "Méthodes d implication des bénéficiaires": W.text(v) }),
    secteurs:       v => ({ "Secteurs d intervention": W.text(v) }),
    validiteDevis:  v => ({ "Validité des devis (jours)": W.num(v) }),
    delaiConvoc:    v => ({ "Délai d envoi des convocations (jours)": W.num(v) }),
    juridiction:    v => ({ "Juridiction compétente": W.text(v) }),
    couleur:        v => ({ "Couleur de marque": W.text(v) }),
  },
};

const BASE = { veille: DB.veille, amelioration: DB.ameliorations, organisme: DB.organisme,
               abandon: DB.abandons, modele: DB.modeles };

function proprietes(entite, champs) {
  const m = MAP[entite] || {};
  const out = {};
  for (const [k, v] of Object.entries(champs || {})) if (m[k]) Object.assign(out, m[k](v));
  return out;
}

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const { action, entite, id, champs } = await readBody(req);
  if (!BASE[entite]) return res.status(400).json({ erreur: "Entité inconnue : " + entite });

  if (action === "creer") {
    const props = proprietes(entite, champs);
    if (!Object.keys(props).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    const page = await notion("/pages", "POST", {
      parent: { database_id: BASE[entite] }, properties: props,
    });
    return res.status(200).json({ ok: true, id: page.id.replace(/-/g, "") });
  }

  /* La date de clôture se renseigne d'elle-même quand l'action est vérifiée,
     et s'efface si l'on revient en arrière. */
  if (entite === "amelioration" && champs && champs.statut !== undefined && champs.cloture === undefined) {
    champs.cloture = champs.statut === "Efficacité vérifiée"
      ? new Date().toISOString().slice(0, 10) : "";
  }

  if (action === "maj") {
    /* La fiche organisme est unique : on la retrouve seule si aucun identifiant n'est fourni */
    let cible = id;
    if (!cible && entite === "organisme") {
      const r = await queryAll(DB.organisme);
      if (!r.length) {
        const page = await notion("/pages", "POST", {
          parent: { database_id: DB.organisme },
          properties: proprietes("organisme", champs),
        });
        return res.status(200).json({ ok: true, id: page.id.replace(/-/g, ""), cree: true });
      }
      cible = r[0].id;
    }
    if (!cible) return res.status(400).json({ erreur: "Identifiant manquant" });
    const props = proprietes(entite, champs);
    if (!Object.keys(props).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    await notion(`/pages/${cible}`, "PATCH", { properties: props });
    return res.status(200).json({ ok: true, id: cible.replace(/-/g, "") });
  }

  if (action === "supprimer") {
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    await notion(`/pages/${id}`, "PATCH", { archived: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erreur: "Action inconnue" });
});

module.exports.THEMES = THEMES;
module.exports.THEME_INVERSE = THEME_INVERSE;
