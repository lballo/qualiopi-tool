/* POST /api/sessions — création et mise à jour des sessions et de leurs créneaux */
const { notion, queryAll, P, W, DB, handler, readBody } = require("./_notion");

const dt = (date, h) => (date ? `${date}T${h || "09:00"}:00.000+02:00` : null);
const mn = t => { const [a, b] = (t || "0:0").split(":").map(Number); return a * 60 + b; };

/* Réécrit l'ensemble des créneaux d'une session (supprime puis recrée) */
async function ecrireCreneaux(sessionId, creneaux) {
  const existants = await queryAll(DB.creneaux, {
    filter: { property: "Session", relation: { contains: sessionId } },
  });
  await Promise.all(existants.map(p => notion(`/pages/${p.id}`, "PATCH", { archived: true })));

  const tries = [...(creneaux || [])].sort(
    (a, b) => a.date.localeCompare(b.date) || mn(a.d) - mn(b.d));
  const jours = [...new Set(tries.map(c => c.date))].sort();

  for (let i = 0; i < tries.length; i++) {
    const c = tries[i];
    const j = jours.indexOf(c.date) + 1;
    await notion("/pages", "POST", {
      parent: { database_id: DB.creneaux },
      properties: {
        "Créneau": W.title(`J${j} — ${c.type}`),
        "Session": W.rel([sessionId]),
        "Type": W.select(c.type),
        "Début": W.date(dt(c.date, c.d)),
        "Fin": W.date(dt(c.date, c.f)),
        "Ordre": W.num(i + 1),
      },
    });
  }
  return { jours: jours.length, creneaux: tries.length,
           debut: jours[0] || null, fin: jours[jours.length - 1] || null };
}

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const body = await readBody(req);
  const { action } = body;

  /* ── Création ── */
  if (action === "creer") {
    const s = body.session || {};
    if (!s.titre?.trim()) return res.status(400).json({ erreur: "Le titre est obligatoire" });

    const page = await notion("/pages", "POST", {
      parent: { database_id: DB.sessions },
      properties: {
        "Titre formation": W.title(s.titre),
        "Code session": W.text(s.code),
        "Type": W.select(s.type || "INTRA"),
        "Modalité": W.select(s.modalite || "Présentiel"),
        "Statut": W.select("Planifiée"),
        "Lieu": W.text(s.lieu),
        "Adresse complète": W.text(s.adresse),
        "Formation": W.rel(s.formationId ? [s.formationId] : []),
        "Entreprise": W.rel(s.clientId ? [s.clientId] : []),
        "👩‍🏫 Formateur·rice": W.rel(s.formateurId ? [s.formateurId] : []),
        "💶 Financeur": W.rel(s.financeurId ? [s.financeurId] : []),
      },
    });
    const sessionId = page.id.replace(/-/g, "");
    const info = await ecrireCreneaux(sessionId, s.creneaux);

    if (info.debut) {
      await notion(`/pages/${sessionId}`, "PATCH", {
        properties: {
          "Date début": W.date(info.debut),
          "Date fin": W.date(info.fin),
          "Durée (jours)": W.num(info.jours),
        },
      });
    }
    return res.status(200).json({ ok: true, id: sessionId });
  }

  /* ── Mise à jour de champs simples ── */
  if (action === "maj") {
    const { id, champs = {} } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const map = {
      titre:        v => ({ "Titre formation": W.title(v) }),
      code:         v => ({ "Code session": W.text(v) }),
      lieu:         v => ({ "Lieu": W.text(v) }),
      adresse:      v => ({ "Adresse complète": W.text(v) }),
      type:         v => ({ "Type": W.select(v) }),
      modalite:     v => ({ "Modalité": W.select(v) }),
      statut:       v => ({ "Statut": W.select(v) }),
      notes:        v => ({ "Notes internes": W.text(v) }),
      convocation:  v => ({ "Convocation envoyée": W.check(v) }),
      formationId:  v => ({ "Formation": W.rel(v ? [v] : []) }),
      clientId:     v => ({ "Entreprise": W.rel(v ? [v] : []) }),
      formateurId:  v => ({ "👩‍🏫 Formateur·rice": W.rel(v ? [v] : []) }),
      financeurId:  v => ({ "💶 Financeur": W.rel(v ? [v] : []) }),
      besoinContexte:    v => ({ "Analyse du besoin — contexte": W.text(v) }),
      besoinObjectifs:   v => ({ "Objectifs attendus par le client": W.text(v) }),
      besoinContraintes: v => ({ "Contraintes et adaptations": W.text(v) }),
      rapportDeroule: v => ({ "Rapport: déroulé & adaptations": W.text(v) }),
      rapportForts:   v => ({ "Rapport: points forts": W.text(v) }),
      rapportDiff:    v => ({ "Rapport: difficultés & solutions": W.text(v) }),
      rapportAxes:    v => ({ "Rapport: axes d'amélioration": W.text(v) }),
      rapportFait:    v => ({ "Rapport complété": W.check(v),
                              "Date rapport": W.date(new Date().toISOString().slice(0, 10)) }),
    };
    const properties = {};
    for (const [k, v] of Object.entries(champs)) {
      if (map[k]) Object.assign(properties, map[k](v));
    }
    if (!Object.keys(properties).length) return res.status(400).json({ erreur: "Aucun champ reconnu" });
    await notion(`/pages/${id}`, "PATCH", { properties });
    return res.status(200).json({ ok: true });
  }

  /* ── Réécriture des créneaux ── */
  if (action === "creneaux") {
    const { id, creneaux } = body;
    if (!id) return res.status(400).json({ erreur: "Identifiant manquant" });
    const info = await ecrireCreneaux(id, creneaux);
    await notion(`/pages/${id}`, "PATCH", {
      properties: {
        "Date début": W.date(info.debut),
        "Date fin": W.date(info.fin),
        "Durée (jours)": W.num(info.jours),
      },
    });
    return res.status(200).json({ ok: true, ...info });
  }

  return res.status(400).json({ erreur: "Action inconnue" });
});
