const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const Groq    = require('groq-sdk');
const { authMiddleware, isConsumer } = require('../middlewares/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ══ Calcul distance Haversine ══
function calcDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// POST /api/recommendations
router.post('/', authMiddleware, isConsumer, async (req, res) => {
  try {
    const userId = req.user.id;

    // ══ ÉTAPE 1 : RETRIEVAL ══

    // 1a. Produits disponibles avec toutes les infos supermarché
    const [products] = await pool.query(`
      SELECT 
        p.id, p.nom, p.marque, p.prix_initial, p.prix_reduit,
        p.jours_avant_expiration, p.stock, p.statut,
        p.image_url, p.category_id,
        c.nom             AS categorie,
        s.nom_magasin,
        s.ville           AS supermarche_ville,
        s.adresse         AS supermarche_adresse,
        s.telephone       AS supermarche_telephone,
        s.image_url       AS supermarche_image,
        s.description     AS supermarche_description,
        s.latitude        AS supermarche_latitude,
        s.longitude       AS supermarche_longitude
      FROM products p
      LEFT JOIN categories   c ON p.category_id = c.id
      LEFT JOIN supermarkets s ON p.user_id      = s.user_id
      WHERE p.statut IN ('disponible', 'urgent', 'attention')
      AND   p.stock > 0
      ORDER BY p.jours_avant_expiration ASC
      LIMIT 30
    `);

    // 1b. Historique commandes du client
    const [history] = await pool.query(`
      SELECT 
        p.nom    AS produit,
        p.marque,
        c.nom    AS categorie,
        o.quantite,
        o.statut,
        o.date_reservation
      FROM orders o
      LEFT JOIN products   p ON o.product_id  = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.user_id = ?
      ORDER BY o.date_reservation DESC
      LIMIT 10
    `, [userId]);

    // 1c. Infos du client — avec latitude/longitude
    const [userRows] = await pool.query(
      'SELECT nom, prenom, ville, latitude, longitude FROM users WHERE id = ?',
      [userId]
    );
    const user = userRows[0];

    if (products.length === 0) {
      return res.json({ recommendations: [] });
    }

    // ══ ÉTAPE 2 : Calcul des distances + construction contexte ══

    const userLat = parseFloat(user.latitude);
    const userLng = parseFloat(user.longitude);
    const hasUserGPS = !isNaN(userLat) && !isNaN(userLng) && userLat !== 0;

    const productsWithDistance = products.map(p => {
      const smLat = parseFloat(p.supermarche_latitude);
      const smLng = parseFloat(p.supermarche_longitude);
      const hasSmGPS = !isNaN(smLat) && !isNaN(smLng) && smLat !== 0;

      let distanceStr = 'distance inconnue';
      let distanceKm  = null;

      if (hasUserGPS && hasSmGPS) {
        distanceKm  = calcDist(userLat, userLng, smLat, smLng);
        distanceStr = `${distanceKm.toFixed(1)} km`;
      } else if (p.supermarche_ville && user.ville) {
        const memeVille = p.supermarche_ville.toLowerCase().trim() === user.ville.toLowerCase().trim();
        distanceStr = memeVille ? 'même ville' : `autre ville (${p.supermarche_ville})`;
      }

      return { ...p, distanceStr, distanceKm };
    });

    const contexte = `
Tu es un assistant de recommandation pour SaveFood, une plateforme anti-gaspillage alimentaire en Tunisie.

CLIENT :
- Nom : ${user.prenom} ${user.nom}
- Ville : ${user.ville || 'non precisee'}
- GPS disponible : ${hasUserGPS ? 'oui' : 'non'}

HISTORIQUE D'ACHATS DU CLIENT :
${history.length > 0
  ? history.map(h =>
      `- ${h.produit}${h.marque ? ' (' + h.marque + ')' : ''} | Categorie: ${h.categorie} | Quantite: ${h.quantite}`
    ).join('\n')
  : 'Aucun achat precedent - nouveau client'
}

PRODUITS DISPONIBLES ACTUELLEMENT :
${productsWithDistance.map(p => {
  const prix      = p.prix_reduit || p.prix_initial;
  const reduction = p.prix_reduit
    ? Math.round((1 - p.prix_reduit / p.prix_initial) * 100)
    : 0;
  return `- ID:${p.id} | ${p.nom}${p.marque ? ' (' + p.marque + ')' : ''} | Categorie: ${p.categorie} | Prix: ${prix} TND${reduction > 0 ? ' (-' + reduction + '%)' : ''} | Expire dans: ${p.jours_avant_expiration} jour(s) | Magasin: ${p.nom_magasin || '?'} | Distance: ${p.distanceStr}`;
}).join('\n')}

MISSION :
Recommande exactement 3 produits parmi ceux listés ci-dessus.

Criteres par ordre de priorite :
1. Produits proches expiration (urgent en priorite)
2. Meilleures reductions
3. Correspond aux preferences du client selon son historique
4. Proximite geographique (preferer les magasins les plus proches en km)

Reponds UNIQUEMENT en JSON valide sans texte avant ou apres :
{
  "recommendations": [
    {
      "product_id": <id du produit>,
      "nom": "<nom du produit>",
      "raison": "<explication courte personnalisee en francais, max 15 mots>"
    },
    {
      "product_id": <id>,
      "nom": "<nom>",
      "raison": "<explication>"
    },
    {
      "product_id": <id>,
      "nom": "<nom>",
      "raison": "<explication>"
    }
  ]
}
    `.trim();

    // ══ ÉTAPE 3 : GENERATION — Appel LLM Groq ══
    const response = await groq.chat.completions.create({
      model      : 'llama-3.3-70b-versatile',
      max_tokens : 500,
      temperature: 0.3,
      messages   : [
        {
          role   : 'system',
          content: 'Tu es un assistant qui repond uniquement en JSON valide. Jamais de texte avant ou apres le JSON.'
        },
        {
          role   : 'user',
          content: contexte
        }
      ],
    });

    // ══ ÉTAPE 4 : Parser la réponse JSON ══
    const rawText = response.choices[0].message.content;
    const clean   = rawText.replace(/```json|```/g, '').trim();
    const parsed  = JSON.parse(clean);

    // ══ ÉTAPE 5 : Enrichir avec les données complètes ══
    const enriched = parsed.recommendations
      .map(rec => {
        const full = productsWithDistance.find(p => p.id === rec.product_id);
        return full ? { ...rec, product: full } : null;
      })
      .filter(r => r !== null);

    res.json({ recommendations: enriched });

  } catch (err) {
    console.error('Erreur recommendations RAG:', err);
    res.status(500).json({
      error          : 'Erreur lors de la generation des recommandations',
      recommendations: []
    });
  }
});

module.exports = router;