/* POST /api/inscriptions — lien session × apprenant (base 👥 Participants) */
const { notion, queryAll, P, W, DB, handler, readBody } = require("./_notion");

const nomComplet = a => [a.nom, a.prenom].filter(Boolean).join(" ").trim() || "Sans nom";
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* Crée la fiche Participant (= inscription) pour un apprenant sur une session */
async function inscrire(sessionId, apprenant, options = {}) {
  const dejaLa = await queryAll(DB.participants, {
    filter: {
      and: [
        { property: "📅 Sessions", relation: { contains: sessionId } },
        { property: "🎓 Apprenant", relation: { contains: apprenant.id } },
      ],
    },
  });
  if (dejaLa.length) return { id: dejaLa[0].id.replace(/-/g, ""), existait: true };

  const page = await notion("/pages", "POST", {
    parent: { database_id: DB.participants },
    properties: {
      "Nom complet": W.title(nomComplet(apprenant)),
      "Prénom": W.text(apprenant.prenom),
      "📅 Sessions": W.rel([sessionId]),
      "🎓 Apprenant": W.rel([apprenant.id]),
      "Entreprise": W.rel(apprenant.entrepriseId ? [apprenant.entrepriseId] : []),
      "Mode d'inscription": W.select(options.mode || "Entreprise (intra)"),
      "Mode de financement": W.select(options.financement || "Employeur / fonds propres"),
    },
  });
  return { id: page.id.replace(/-/g, ""), existait: false };
}

/* Trouve ou crée un apprenant à partir d'une ligne importée */
async function apprenantDeLigne(ligne, entrepriseId) {
  if (ligne.email) {
    const r = await queryAll(DB.apprenants, {
      filter: { property: "Email", email: { equals: ligne.email } },
    });
    if (r[0]) {
      const p = r[0];
      return {
        id: p.id.replace(/-/g, ""), cree: false,
        nom: P.text(p.properties, "Nom") || P.title(p.properties, "Nom complet"),
        prenom: P.text(p.properties, "Prénom"),
        entrepriseId: P.rel1(p.properties, "Entreprise"),
      };
    }
  }
  const page = await notion("/pages", "POST", {
    parent: { database_id: DB.apprenants },
    properties: {
      "Nom complet": W.title(nomComplet(ligne)),
      "Nom": W.text(ligne.nom),
      "Prénom": W.text(ligne.prenom),
      "Email": W.email(ligne.email),
      "Téléphone": W.phone(ligne.tel),
      "Fonction": W.text(ligne.fonction),
      "Entreprise": W.rel(entrepriseId ? [entrepriseId] : []),
    },
  });
  return { id: page.id.replace(/-/g, ""), cree: true, nom: ligne.nom, prenom: ligne.prenom, entrepriseId };
}

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const body = await readBody(req);
  const { action } = body;

  /* ── Inscrire des apprenants existants ── */
  if (action === "inscrire") {
    const { sessionId, apprenants = [], options = {} } = body;
    if (!sessionId) return res.status(400).json({ erreur: "Session manquante" });
    const faits = [];
    for (const a of apprenants) {
      const r = await inscrire(sessionId, a, options);
      faits.push(r);
    }
    return res.status(200).json({
      ok: true,
      crees: faits.filter(f => !f.existait).length,
      deja: faits.filter(f => f.existait).length,
      ids: faits.map(f => f.id),
    });
  }

  /* ── Import de lignes (crée les apprenants manquants puis inscrit) ── */
  if (action === "importer") {
    const { sessionId, lignes = [], entrepriseId, options = {} } = body;
    if (!sessionId) return res.status(400).json({ erreur: "Session manquante" });
    let crees = 0, rattaches = 0, inscriptions = 0;
    for (const ligne of lignes) {
      if (!ligne.nom?.trim()) continue;
      const a = await apprenantDeLigne(ligne, entrepriseId);
      a.cree ? crees++ : rattaches++;
      const r = await inscrire(sessionId, a, options);
      if (!r.existait) inscriptions++;
    }
    return res.status(200).json({ ok: true, crees, rattaches, inscriptions });
  }

  /* ── Mise à jour d'une inscription ── */
  if (action === "maj") {
    const { id, champs = {} } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const map = {
      pos:         v => ({ "Positionnement complété": W.check(v) }),
      sat:         v => ({ "Satisfaction complétée": W.check(v) }),
      froid:       v => ({ "Éval à froid complétée": W.check(v) }),
      evaluation:  v => ({ "Évaluation complétée": W.check(v) }),
      attestation: v => ({ "Attestation remise": W.check(v) }),
      mode:        v => ({ "Mode d'inscription": W.select(v) }),
      financement: v => ({ "Mode de financement": W.select(v) }),
      financeurId: v => ({ "💶 Financeur": W.rel(v ? [v] : []) }),
      montant:     v => ({ "Montant pris en charge": W.num(v) }),
      adaptation:  v => ({ "Besoin d'adaptation à signaler": W.check(v) }),
      besoin:      v => ({ "Besoin d'adaptation spécifique de la formation? ": W.text(v) }),
      mesures:     v => ({ "Mesures adaptées mises en place": W.text(v) }),
      notes:       v => ({ "Notes": W.text(v) }),
    };
    const properties = {};
    for (const [k, v] of Object.entries(champs)) if (map[k]) Object.assign(properties, map[k](v));
    if (!Object.keys(properties).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    await notion(`/pages/${id}`, "PATCH", { properties });
    return res.status(200).json({ ok: true });
  }

  /* ── Convocation ── */
  if (action === "convocation") {
    const { id, envoyee = true } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const date = envoyee ? aujourdhui() : null;
    await notion(`/pages/${id}`, "PATCH", {
      properties: {
        "Convocation envoyée": W.check(envoyee),
        "Date d'envoi de la convocation": W.date(date),
      },
    });
    return res.status(200).json({ ok: true, date });
  }

  /* ── Désinscrire ── */
  if (action === "desinscrire") {
    const { id } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    await notion(`/pages/${id}`, "PATCH", { archived: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erreur: "Action inconnue" });
});
