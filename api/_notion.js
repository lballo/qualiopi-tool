/* ────────────────────────────────────────────────────────────────
   Client Notion partagé — panel de gestion Qualiopi
   Toutes les fonctions serverless importent ce module.
   ──────────────────────────────────────────────────────────────── */

const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";

/* ── Identifiants des bases ── */
const DB = {
  sessions:       "2fd075e127d281d5a34bdeacdc88c160",
  creneaux:       "929d5a9efb3d41a9b6e5cca9f17426e1",
  participants:   "2fd075e127d281108567d716b7d6b3e1",
  apprenants:     "b07b9018681f4d9a86f9925daa9f15b6",
  formations:     "2fd075e127d2817c9efdf1339b79a765",
  entreprises:    "2fd075e127d2819f9fabd4820a69f7f8",
  collaborateurs: "6ea075e127d282aebd248144a3b0b262",
  financeurs:     "242600454865420ba9cb67b5084d16e0",
  emargements:    "2fd075e127d281a48683e5c9f16c411b",
};

/* ── Appel générique ── */
async function notion(path, method = "GET", body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || res.statusText;
    const err = new Error(`Notion ${res.status} — ${msg}`);
    err.status = res.status;
    err.notion = data;
    throw err;
  }
  return data;
}

/* ── Lecture paginée complète d'une base ── */
async function queryAll(dbId, body = {}) {
  const out = [];
  let cursor;
  do {
    const page = await notion(`/databases/${dbId}/query`, "POST", {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

/* ── Lecture de propriétés ── */
const P = {
  title:  (p, k) => p[k]?.title?.map(t => t.plain_text).join("") || "",
  text:   (p, k) => p[k]?.rich_text?.map(t => t.plain_text).join("") || "",
  num:    (p, k) => (typeof p[k]?.number === "number" ? p[k].number : null),
  check:  (p, k) => !!p[k]?.checkbox,
  select: (p, k) => p[k]?.select?.name || "",
  multi:  (p, k) => (p[k]?.multi_select || []).map(s => s.name),
  date:   (p, k) => p[k]?.date?.start || "",
  dateEnd:(p, k) => p[k]?.date?.end || "",
  email:  (p, k) => p[k]?.email || "",
  phone:  (p, k) => p[k]?.phone_number || "",
  url:    (p, k) => p[k]?.url || "",
  rel:    (p, k) => (p[k]?.relation || []).map(r => r.id.replace(/-/g, "")),
  rel1:   (p, k) => (p[k]?.relation || [])[0]?.id?.replace(/-/g, "") || "",
  files:  (p, k) => (p[k]?.files || []).map(f => ({
            nom: f.name,
            url: f.type === "file" ? f.file?.url : f.external?.url,
          })),
  formula:(p, k) => {
            const f = p[k]?.formula;
            if (!f) return null;
            return f.string ?? f.number ?? f.boolean ?? f.date?.start ?? null;
          },
  rollup: (p, k) => {
            const r = p[k]?.rollup;
            if (!r) return null;
            if (r.type === "number") return r.number;
            if (r.type === "array") return r.array;
            return null;
          },
};

/* ── Écriture de propriétés (valeurs vides = effacement) ── */
const W = {
  title:  v => ({ title: [{ text: { content: String(v ?? "").slice(0, 2000) } }] }),
  text:   v => ({ rich_text: v ? [{ text: { content: String(v).slice(0, 2000) } }] : [] }),
  num:    v => ({ number: v === "" || v === null || v === undefined ? null : Number(v) }),
  check:  v => ({ checkbox: !!v }),
  select: v => ({ select: v ? { name: v } : null }),
  multi:  v => ({ multi_select: (v || []).map(name => ({ name })) }),
  date:   (start, end) => ({ date: start ? { start, ...(end ? { end } : {}) } : null }),
  email:  v => ({ email: v || null }),
  phone:  v => ({ phone_number: v || null }),
  url:    v => ({ url: v || null }),
  rel:    ids => ({ relation: (ids || []).filter(Boolean).map(id => ({ id })) }),
};

/* ── Garde d'authentification ── */
function auth(req, res) {
  const key = req.headers["x-cle"] || req.query?.key || "";
  if (!process.env.DASHBOARD_SECRET) {
    res.status(500).json({ erreur: "DASHBOARD_SECRET absent de la configuration" });
    return false;
  }
  if (key !== process.env.DASHBOARD_SECRET) {
    res.status(401).json({ erreur: "Clé invalide" });
    return false;
  }
  return true;
}

/* ── Corps de requête JSON ── */
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/* ── Enveloppe de gestion d'erreurs ── */
function handler(fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (!auth(req, res)) return;
    try {
      await fn(req, res);
    } catch (e) {
      console.error("[gestion]", e);
      res.status(e.status || 500).json({ erreur: e.message || "Erreur serveur" });
    }
  };
}

module.exports = { notion, queryAll, P, W, DB, auth, readBody, handler, NOTION_VERSION };
