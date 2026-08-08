# Panel de gestion Qualiopi — Laura Ballo Coaching

Interface de gestion connectée aux bases Notion du template Qualiopi.
Projet **séparé** de `formation-app` : il dispose de son propre budget de fonctions serverless
(la limite de 12 sur l'offre Hobby s'applique par déploiement, pas par compte).

---

## Mise en ligne

1. **Créer le dépôt GitHub** (par exemple `gestion-qualiopi`) et y déposer ces fichiers.
2. **Importer le dépôt dans Vercel** : Add New → Project → sélectionner le dépôt.
3. **Renseigner les deux variables d'environnement** (Settings → Environment Variables),
   sur les trois environnements Production, Preview et Development :

   | Variable | Valeur |
   |---|---|
   | `NOTION_API_KEY` | la même clé d'intégration que `formation-app` |
   | `DASHBOARD_SECRET` | le mot de passe d'accès au panel |

4. **Déployer**, puis ouvrir l'URL et saisir le `DASHBOARD_SECRET` sur l'écran de connexion.
5. *(facultatif)* Rattacher un sous-domaine, par exemple `gestion.lauraballo.com`.

⚠️ L'intégration Notion doit avoir accès aux bases utilisées. Si une base renvoie une erreur 404,
ouvrez-la dans Notion → menu ⋯ → Connexions → ajouter l'intégration.

---

## Structure

```
index.html              interface complète (reprend la maquette validée)
api/_notion.js          client Notion partagé : bases, lecture/écriture, authentification
api/data.js             GET  — chargement initial de toutes les bases
api/sessions.js         POST — créer une session, modifier ses champs, réécrire ses créneaux
api/apprenants.js       POST — créer, modifier, supprimer un apprenant
api/inscriptions.js     POST — inscrire, importer, mettre à jour un parcours, convoquer
api/upload.js           POST — déposer un fichier dans une propriété Notion
```

**5 fonctions serverless sur 12** — il reste de la place pour les lots suivants.

---

## Ce qui est connecté (lot 1)

| Écran | Lecture | Écriture |
|---|---|---|
| Tableau de bord | ✅ | — |
| Sessions (liste et fiche) | ✅ | ✅ création, besoin, rapport, convention, convocations |
| Nouvelle session | — | ✅ session + créneaux en une opération |
| Apprenants | ✅ | ✅ création, modification, suppression |
| Fiche apprenant | ✅ | ✅ identité, convocations |
| Fiche inscription | ✅ | ✅ mode, financement, montant, parcours, attestation, adaptation |
| Import | — | ✅ dédoublonnage par email, création + inscription |

Les autres écrans (formations, formateurs, clients, financeurs, veille, organisme) **affichent les
données réelles** de Notion mais signalent un bandeau « Lecture seule » : leurs modifications ne
sont pas encore enregistrées. Ce sont les lots suivants.

### Émargements

Les signatures ne se saisissent pas depuis le panel : elles viennent des liens stagiaire et
formateur de `formation-app`, qui écrivent dans la base ✍️ Émargements. Le panel les affiche
uniquement. C'est volontaire — une signature saisie par l'organisme n'aurait aucune valeur probante.

---

## Dépôt de fichiers

L'envoi passe par l'API File Upload de Notion, en trois temps : création de l'objet, envoi du
binaire, rattachement à la propriété. **Limite de 4 Mo par fichier** (contrainte de taille de corps
de requête sur Vercel), au-delà le panel refuse avec un message explicite.

Si Notion refuse l'envoi avec une erreur de version, modifiez `NOTION_VERSION` dans
`api/_notion.js` — la valeur actuelle est `2022-06-28`.

---

## Comportement en cas d'erreur

La saisie n'est jamais bloquée : l'écran se met à jour immédiatement, puis l'enregistrement part
vers Notion. Si Notion refuse, un message `⚠ Non enregistré : …` apparaît en bas de l'écran.
Le bouton **↻ Recharger** relit l'état réel des bases et permet de vérifier ce qui a été écrit.
