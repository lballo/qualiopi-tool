/* POST /api/annuaire — formateurs, clients (+ contacts, documents, échanges), financeurs */
const { notion, queryAll, P, W, DB, handler, readBody } = require("./_notion");

const nomComplet = o => [o.prenom, o.nom].filter(Boolean).join(" ").trim() || "Sans nom";

/* ── Correspondances par entité ── */
const MAP = {
  formateur: {
    nom:      v => ({ "Nom": W.title(v) }),
    prenom:   v => ({ "Prénom": W.text(v) }),
    fonction: v => ({ "Fonction": W.text(v) }),
    statut:   v => ({ "Statut": W.select(v) }),
    type:     v => ({ "Type d intervenant": W.select(v) }),
    email:    v => ({ "Email": W.email(v) }),
    tel:      v => ({ "Téléphone": W.phone(v) }),
    entree:   v => ({ "Date d entrée": W.date(v) }),
    sortie:   v => ({ "Date de sortie": W.date(v) }),
    notes:    v => ({ "Notes": W.text(v) }),
    actif:    v => ({ "Actif": W.check(v) }),
    domaines: v => ({ "Domaines d intervention": W.multi(v) }),
    refPeda:     v => ({ "Référent pédagogique": W.check(v) }),
    refAdmin:    v => ({ "Référent administratif": W.check(v) }),
    refHandicap: v => ({ "Référent handicap": W.check(v) }),
    formations:  v => ({ "📚 Formations habilitées": W.rel(v) }),
  },
  client: {
    nom:     v => ({ "Nom": W.title(v) }),
    type:    v => ({ "Type": W.select(v) }),
    statut:  v => ({ "Statut": W.select(v) }),
    siret:   v => ({ "SIRET": W.text(v) }),
    email:   v => ({ "Email": W.email(v) }),
    tel:     v => ({ "Téléphone": W.phone(v) }),
    adresse: v => ({ "Adresse": W.text(v) }),
    cp:      v => ({ "Code postal": W.text(v) }),
    ville:   v => ({ "Ville": W.text(v) }),
    formeJuridique: v => ({ "Forme juridique": W.select(v) }),
    secteur: v => ({ "Secteur d'activité": W.select(v) }),
    cadrage: v => ({ "Cadrage formation": W.text(v) }),
    notes:   v => ({ "Notes internes": W.text(v) }),
  },
  contact: {
    nom:      v => ({ "Nom": W.title(v) }),
    prenom:   v => ({ "Prénom": W.text(v) }),
    civilite: v => ({ "Civilité": W.select(v) }),
    fonction: v => ({ "Fonction": W.text(v) }),
    email:    v => ({ "Email": W.email(v) }),
    tel:      v => ({ "Téléphone": W.phone(v) }),
    linkedin: v => ({ "LinkedIn": W.url(v) }),
    principal:v => ({ "Contact principal": W.check(v) }),
    repLegal: v => ({ "Représentant légal": W.check(v) }),
    notes:    v => ({ "Notes": W.text(v) }),
    entrepriseId: v => ({ "Entreprise": W.rel(v ? [v] : []) }),
  },
  financeur: {
    nom:     v => ({ "Nom du financeur": W.title(v) }),
    type:    v => ({ "Type": W.select(v) }),
    email:   v => ({ "Email": W.email(v) }),
    tel:     v => ({ "Téléphone": W.phone(v) }),
    adresse: v => ({ "Adresse": W.text(v) }),
    cp:      v => ({ "Code postal": W.text(v) }),
    ville:   v => ({ "Ville": W.text(v) }),
    site:    v => ({ "Site web": W.url(v) }),
    portail: v => ({ "Espace de dépôt en ligne": W.url(v) }),
    contact: v => ({ "Contact référent": W.text(v) }),
    numero:  v => ({ "Numéro d adhérent / de compte": W.text(v) }),
    conditions: v => ({ "Conditions de prise en charge": W.text(v) }),
    delai:   v => ({ "Délai de dépôt (jours avant formation)": W.num(v) }),
    actif:   v => ({ "Actif": W.check(v) }),
    notes:   v => ({ "Notes internes": W.text(v) }),
  },
  document: {
    titre:     v => ({ "Titre": W.title(v) }),
    type:      v => ({ "Type": W.select(v) }),
    statut:    v => ({ "Statut": W.select(v) }),
    envoi:     v => ({ "Date d envoi": W.date(v) }),
    signature: v => ({ "Date de signature": W.date(v) }),
    montant:   v => ({ "Montant HT": W.num(v) }),
    signataire:v => ({ "Signataire côté client": W.text(v) }),
    notes:     v => ({ "Notes": W.text(v) }),
    clientId:  v => ({ "Entreprise": W.rel(v ? [v] : []) }),
    sessionId: v => ({ "Session": W.rel(v ? [v] : []) }),
  },
  echange: {
    titre:    v => ({ "Titre": W.title(v) }),
    type:     v => ({ "Type": W.select(v) }),
    date:     v => ({ "Date": W.date(v) }),
    cr:       v => ({ "Compte rendu": W.text(v) }),
    suite:    v => ({ "Prochaine action": W.text(v) }),
    clientId: v => ({ "Entreprise": W.rel(v ? [v] : []) }),
  },
  suivi: {
    titre:       v => ({ "Intitulé": W.title(v) }),
    type:        v => ({ "Type": W.select(v) }),
    date:        v => ({ "Date": W.date(v) }),
    organisme:   v => ({ "Organisme ou source": W.text(v) }),
    duree:       v => ({ "Durée (heures)": W.num(v) }),
    competences: v => ({ "Compétences visées": W.text(v) }),
    suites:      v => ({ "Suites données": W.text(v) }),
    annee:       v => ({ "Année": W.text(v) }),
    formateurId: v => ({ "Intervenant": W.rel(v ? [v] : []) }),
  },
};

const BASE = {
  formateur: DB.collaborateurs, client: DB.entreprises, contact: DB.contacts,
  financeur: DB.financeurs, document: DB.documents, echange: DB.interactions,
  suivi: DB.competences,
};

function proprietes(entite, champs) {
  const m = MAP[entite] || {};
  const out = {};
  for (const [k, v] of Object.entries(champs || {})) if (m[k]) Object.assign(out, m[k](v));
  return out;
}

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const { action, entite, id, champs, obligatoire } = await readBody(req);

  if (!BASE[entite]) return res.status(400).json({ erreur: "Entité inconnue : " + entite });

  if (action === "creer") {
    const props = proprietes(entite, champs);
    /* Le titre des formateurs et contacts reprend le nom de famille seul ;
       on complète avec le prénom pour rester lisible dans Notion. */
    if (entite === "contact" && champs?.nom) props["Nom"] = W.title(nomComplet(champs));
    if (!Object.keys(props).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    if (obligatoire && !String(champs[obligatoire] || "").trim()) {
      return res.status(400).json({ erreur: "Champ obligatoire manquant : " + obligatoire });
    }
    const page = await notion("/pages", "POST", {
      parent: { database_id: BASE[entite] },
      properties: props,
    });
    return res.status(200).json({ ok: true, id: page.id.replace(/-/g, "") });
  }

  if (action === "maj") {
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const props = proprietes(entite, champs);
    if (entite === "contact" && (champs?.nom !== undefined || champs?.prenom !== undefined)) {
      const page = await notion(`/pages/${id}`);
      const actuel = {
        nom: champs.nom !== undefined ? champs.nom : P.title(page.properties, "Nom"),
        prenom: champs.prenom !== undefined ? champs.prenom : P.text(page.properties, "Prénom"),
      };
      props["Nom"] = W.title(nomComplet(actuel));
    }
    if (!Object.keys(props).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    await notion(`/pages/${id}`, "PATCH", { properties: props });
    return res.status(200).json({ ok: true });
  }

  if (action === "supprimer") {
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });

    /* Garde-fous : on refuse de supprimer ce qui est encore utilisé */
    if (entite === "formateur") {
      const s = await queryAll(DB.sessions, {
        filter: { property: "👩‍🏫 Formateur·rice", relation: { contains: id } } });
      if (s.length) return res.status(409).json({ erreur: `Impossible : ${s.length} session(s) rattachée(s)` });
    }
    if (entite === "client") {
      const s = await queryAll(DB.sessions, {
        filter: { property: "Entreprise", relation: { contains: id } } });
      if (s.length) return res.status(409).json({ erreur: `Impossible : ${s.length} session(s) rattachée(s)` });
    }
    if (entite === "financeur") {
      const s = await queryAll(DB.sessions, {
        filter: { property: "💶 Financeur", relation: { contains: id } } });
      if (s.length) return res.status(409).json({ erreur: `Impossible : ${s.length} session(s) financée(s)` });
    }

    await notion(`/pages/${id}`, "PATCH", { archived: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erreur: "Action inconnue" });
});
