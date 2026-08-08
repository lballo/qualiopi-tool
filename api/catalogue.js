/* POST /api/catalogue — base 📚 Formations */
const { notion, queryAll, P, W, DB, handler, readBody } = require("./_notion");

/* Correspondance champ de l'interface → propriété Notion */
const MAP = {
  nom:          v => ({ "Nom de la formation": W.title(v) }),
  code:         v => ({ "Code formation": W.text(v) }),
  duree:        v => ({ "Durée (heures)": W.num(v) }),
  jours:        v => ({ "Durée (jours)": W.num(v) }),
  modalite:     v => ({ "Modalités": W.select(v) }),
  categorie:    v => ({ "Catégorie": W.select(v) }),
  accroche:     v => ({ "Accroche": W.text(v) }),
  objectif:     v => ({ "Objectif professionnel": W.text(v) }),
  objectifsOp:  v => ({ "Objectifs opérationnels": W.text(v) }),
  publicCible:  v => ({ "Public cible": W.text(v) }),
  prerequis:    v => ({ "Prérequis": W.text(v) }),
  delais:       v => ({ "Délais d'accès": W.text(v) }),
  tarif:        v => ({ "Tarif HT intra": W.num(v) }),
  tarifInter:   v => ({ "Tarif HT inter": W.num(v) }),
  typeTarif:    v => ({ "Type de tarif": W.select(v) }),
  nsf:          v => ({ "Code NSF": W.text(v) }),
  nature:       v => ({ "Nature de l action": W.select(v) }),
  accessibilite:v => ({ "Accessibilité handicap": W.text(v) }),
  sanction:     v => ({ "Sanction de la formation": W.text(v) }),
  contenu:      v => ({ "Contenu de formation": W.text(v) }),
  evalDesc:     v => ({ "Évaluations formatives (description)": W.text(v) }),
  evalModalites:v => ({ "Modalités d évaluation": W.text(v) }),
  statutPub:    v => ({ "Statut publication": W.select(v) }),
  slug:         v => ({ "slug": W.text(v) }),
  titreSeo:     v => ({ "Titre SEO": W.text(v) }),
  metaDesc:     v => ({ "Méta-description": W.text(v) }),
  image:        v => ({ "Image (fichier)": W.text(v) }),
  motsCles:     v => ({ "Mots-clés (recherche)": W.text(v) }),
  pointsForts:  v => ({ "Points forts": W.text(v) }),
  tags:         v => ({ "Tags": W.multi(v) }),
  formateurs:   v => ({ "👩‍🏫 Formateurs qualifiés": W.rel(v) }),
  "moyens.modalites":  v => ({ "Modalités pédagogiques": W.text(v) }),
  "moyens.methodes":   v => ({ "Méthodes pédagogiques": W.text(v) }),
  "moyens.ressources": v => ({ "Ressources pédagogiques (texte)": W.text(v) }),
  "moyens.profil":     v => ({ "Profil de l intervenant": W.text(v) }),
  "technique.locaux":   v => ({ "Locaux (description)": W.text(v) }),
  "technique.equip":    v => ({ "Équipements (description)": W.text(v) }),
  "technique.locauxPar":v => ({ "Locaux mis à disposition par": W.multi(v) }),
  "technique.equipPar": v => ({ "Équipements mis à disposition par": W.multi(v) }),
};

function proprietes(champs) {
  const out = {};
  for (const [k, v] of Object.entries(champs || {})) if (MAP[k]) Object.assign(out, MAP[k](v));
  return out;
}

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const body = await readBody(req);
  const { action } = body;

  if (action === "creer") {
    const f = body.formation || {};
    if (!f.nom?.trim()) return res.status(400).json({ erreur: "Le titre est obligatoire" });
    const page = await notion("/pages", "POST", {
      parent: { database_id: DB.formations },
      properties: {
        ...proprietes(f),
        "Statut publication": W.select(f.statutPub || "Non publié"),
        "Dernière mise à jour": W.date(new Date().toISOString().slice(0, 10)),
      },
    });
    return res.status(200).json({ ok: true, id: page.id.replace(/-/g, "") });
  }

  if (action === "maj") {
    const { id, champs } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const properties = proprietes(champs);
    if (!Object.keys(properties).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    properties["Dernière mise à jour"] = W.date(new Date().toISOString().slice(0, 10));
    await notion(`/pages/${id}`, "PATCH", { properties });
    return res.status(200).json({ ok: true });
  }

  if (action === "supprimer") {
    const { id } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const liees = await queryAll(DB.sessions, {
      filter: { property: "Formation", relation: { contains: id } },
    });
    if (liees.length) {
      return res.status(409).json({ erreur: `Impossible : ${liees.length} session(s) utilisent cette formation` });
    }
    await notion(`/pages/${id}`, "PATCH", { archived: true });
    return res.status(200).json({ ok: true });
  }

  /* Retirer un fichier d'une propriété (le dépôt passe par /api/upload) */
  if (action === "retirerFichier") {
    const { id, propriete } = body;
    if (!id || !propriete) return res.status(400).json({ erreur: "Paramètres manquants" });
    await notion(`/pages/${id}`, "PATCH", { properties: { [propriete]: { files: [] } } });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erreur: "Action inconnue" });
});
