/* POST /api/apprenants — répertoire des personnes (identité seule) */
const { notion, queryAll, P, W, DB, handler, readBody } = require("./_notion");

const nomComplet = a => [a.nom, a.prenom].filter(Boolean).join(" ").trim() || "Sans nom";

/* Cherche un apprenant existant par email (dédoublonnage) */
async function trouverParEmail(email) {
  if (!email) return null;
  const r = await queryAll(DB.apprenants, {
    filter: { property: "Email", email: { equals: email } },
  });
  return r[0] ? r[0].id.replace(/-/g, "") : null;
}

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const body = await readBody(req);
  const { action } = body;

  if (action === "creer") {
    const a = body.apprenant || {};
    if (!a.nom?.trim()) return res.status(400).json({ erreur: "Le nom est obligatoire" });

    const existant = await trouverParEmail(a.email);
    if (existant) return res.status(200).json({ ok: true, id: existant, existait: true });

    const page = await notion("/pages", "POST", {
      parent: { database_id: DB.apprenants },
      properties: {
        "Nom complet": W.title(nomComplet(a)),
        "Nom": W.text(a.nom),
        "Prénom": W.text(a.prenom),
        "Email": W.email(a.email),
        "Téléphone": W.phone(a.tel),
        "Fonction": W.text(a.fonction),
        "Entreprise": W.rel(a.entrepriseId ? [a.entrepriseId] : []),
        "Notes": W.text(a.notes),
      },
    });
    return res.status(200).json({ ok: true, id: page.id.replace(/-/g, ""), existait: false });
  }

  if (action === "maj") {
    const { id, champs = {} } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const map = {
      nom:          v => ({ "Nom": W.text(v) }),
      prenom:       v => ({ "Prénom": W.text(v) }),
      email:        v => ({ "Email": W.email(v) }),
      tel:          v => ({ "Téléphone": W.phone(v) }),
      fonction:     v => ({ "Fonction": W.text(v) }),
      notes:        v => ({ "Notes": W.text(v) }),
      entrepriseId: v => ({ "Entreprise": W.rel(v ? [v] : []) }),
    };
    const properties = {};
    for (const [k, v] of Object.entries(champs)) if (map[k]) Object.assign(properties, map[k](v));
    if (champs.nom !== undefined || champs.prenom !== undefined) {
      const page = await notion(`/pages/${id}`);
      const actuel = {
        nom: champs.nom !== undefined ? champs.nom : P.text(page.properties, "Nom"),
        prenom: champs.prenom !== undefined ? champs.prenom : P.text(page.properties, "Prénom"),
      };
      properties["Nom complet"] = W.title(nomComplet(actuel));
    }
    if (!Object.keys(properties).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    await notion(`/pages/${id}`, "PATCH", { properties });
    return res.status(200).json({ ok: true });
  }

  if (action === "supprimer") {
    const { id } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const page = await notion(`/pages/${id}`);
    const inscriptions = (page.properties["👥 Inscriptions"]?.relation || []).length;
    if (inscriptions) {
      return res.status(409).json({ erreur: `Impossible : ${inscriptions} inscription(s) rattachée(s)` });
    }
    await notion(`/pages/${id}`, "PATCH", { archived: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erreur: "Action inconnue" });
});
