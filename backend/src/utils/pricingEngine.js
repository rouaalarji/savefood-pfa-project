const axios = require('axios');

const IA_API_URL = process.env.IA_API_URL || 'http://localhost:5001';

/**
 * Calcule le prix réduit par l'IA Flask
 */
async function predictPrice(product) {
  try {
    const response = await axios.post(`${IA_API_URL}/predict-price`, {
      category_id: product.category_id,
      prix_initial: parseFloat(product.prix_initial),
      jours_avant_expiration: parseInt(product.jours_avant_expiration),
      stock: parseInt(product.stock)
    }, { timeout: 5000 });

    return {
  prix_reduit: response.data.prix_suggere,
  source: 'ia'
};
  } catch (error) {
    // IA obligatoire → on lance une erreur si Flask est éteint
    console.error(`❌ IA indisponible ! Assurez-vous que Flask tourne sur ${IA_API_URL}`);
    throw new Error(`API IA indisponible. Démarrez Flask avec : python app.py`);
  }
}

/**
 * Calcul du prix réduit par règles fixes (fallback si IA indisponible)
 */
function calculerPrixParRegles(product) {
  const jours = parseInt(product.jours_avant_expiration);
  const prix = parseFloat(product.prix_initial);

  let reduction = 0;

  if (jours <= 1)       reduction = 0.50;  // -50%
  else if (jours <= 2)  reduction = 0.35;  // -35%
  else if (jours <= 3)  reduction = 0.25;  // -25%
  else if (jours <= 5)  reduction = 0.15;  // -15%
  else if (jours <= 7)  reduction = 0.05;  // -5%
  else                  reduction = 0;     // pas de réduction

  const prix_reduit = parseFloat((prix * (1 - reduction)).toFixed(3));

  return {
    prix_reduit: prix_reduit,
    source: 'regles'
  };
}

/**
 * Met à jour les prix de TOUS les produits
 * Appelé par le CRON job et la route /update-prices
 */
async function updateAllProductsPrices(pool, useIA = false) {
  console.log(`\n🔄 [PricingEngine] Début de la mise à jour...`);
  console.log(`   Mode: ${useIA ? '🤖 IA' : '📏 Règles fixes'}`);

  // Récupérer tous les produits non expirés
  const [products] = await pool.query(`
    SELECT id, category_id, prix_initial, jours_avant_expiration, stock, statut
    FROM products
    WHERE statut != 'expire' AND jours_avant_expiration > 0
  `);

  console.log(`   📦 ${products.length} produits à traiter`);

  let updated = 0;
  let usedIA = 0;
  let usedRules = 0;
  let expired = 0;

  for (const product of products) {
    try {
      let result;

      // Uniquement l'IA
      result = await predictPrice(product);

      // Mettre à jour le statut aussi
      const jours = product.jours_avant_expiration;
      let statut = 'disponible';
      if (jours <= 0)      statut = 'expire';
      else if (jours <= 2) statut = 'urgent';
      else if (jours <= 5) statut = 'attention';

      // Sauvegarder dans la BDD
      await pool.query(`
        UPDATE products 
        SET prix_reduit = ?, statut = ?, date_modification = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [result.prix_reduit, statut, product.id]);

      updated++;
      if (result.source === 'ia') usedIA++;
      else usedRules++;

    } catch (error) {
      console.error(`❌ Erreur produit ID ${product.id}:`, error.message);
    }
  }

  // Marquer les produits expirés
  const [expiredResult] = await pool.query(`
    UPDATE products SET statut = 'expire'
    WHERE jours_avant_expiration <= 0 AND statut != 'expire'
  `);
  expired = expiredResult.affectedRows;

  console.log(`✅ [PricingEngine] Terminé !`);
  console.log(`   Mis à jour: ${updated} | IA: ${usedIA} | Règles: ${usedRules} | Expirés: ${expired}`);

  return { updated, usedIA, usedRules, expired };
}

module.exports = { updateAllProductsPrices, predictPrice, calculerPrixParRegles };