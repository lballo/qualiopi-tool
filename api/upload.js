/* POST /api/upload — dépôt d'un fichier dans une propriété fichier de Notion
   Procédure Notion en trois temps :
     1. création de l'objet file_upload
     2. envoi du contenu binaire vers l'URL retournée
     3. rattachement de l'identifiant à la propriété de la page
   Le client envoie le fichier en base64 (limite pratique ≈ 4 Mo, contrainte Vercel). */
const { notion, W, handler, readBody, NOTION_VERSION } = require("./_notion");

const LIMITE_OCTETS = 4 * 1024 * 1024;

module.exports = handler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const { pageId, propriete, nom, contenu, type } = await readBody(req);

  if (!pageId || !propriete) return res.status(400).json({ erreur: "Page ou propriété manquante" });
  if (!contenu) return res.status(400).json({ erreur: "Fichier manquant" });

  const binaire = Buffer.from(contenu, "base64");
  if (binaire.length > LIMITE_OCTETS) {
    return res.status(413).json({
      erreur: `Fichier trop lourd (${Math.round(binaire.length / 1024 / 1024 * 10) / 10} Mo). Limite : 4 Mo.`,
    });
  }

  /* 1 — création de l'objet d'upload */
  const upload = await notion("/file_uploads", "POST", {
    filename: nom || "document.pdf",
    content_type: type || "application/pdf",
  });

  /* 2 — envoi du contenu */
  const form = new FormData();
  form.append("file", new Blob([binaire], { type: type || "application/pdf" }), nom || "document.pdf");

  const envoi = await fetch(upload.upload_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
    },
    body: form,
  });
  if (!envoi.ok) {
    const detail = await envoi.text().catch(() => "");
    return res.status(502).json({ erreur: `Envoi refusé par Notion (${envoi.status})`, detail: detail.slice(0, 300) });
  }

  /* 3 — rattachement à la propriété */
  const existants = [];
  if (req.query?.remplacer !== "1") {
    const page = await notion(`/pages/${pageId}`);
    const actuels = page.properties?.[propriete]?.files || [];
    actuels.forEach(f => {
      if (f.type === "external") existants.push({ name: f.name, external: { url: f.external.url } });
      else if (f.file_upload) existants.push({ name: f.name, file_upload: { id: f.file_upload.id } });
    });
  }

  await notion(`/pages/${pageId}`, "PATCH", {
    properties: {
      [propriete]: {
        files: [...existants, { name: nom || "document.pdf", file_upload: { id: upload.id } }],
      },
    },
  });

  res.status(200).json({ ok: true, nom: nom || "document.pdf", id: upload.id });
});
