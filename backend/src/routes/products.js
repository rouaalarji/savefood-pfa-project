const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authMiddleware, isSupermarket } = require('../middlewares/auth');
const PricingEngine = require('../utils/pricingEngine');
const pool = require('../config/database');
const axios = require('axios');

// ✅ Catégories (PUBLIC)
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.getCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

// ✅ Suggestion de prix par IA
router.post('/suggest-price', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const { category_id, prix_initial, jours_avant_expiration, stock } = req.body;

    const response = await axios.post(
      `${process.env.IA_API_URL || 'http://localhost:5001'}/predict-price`,
      {
        category_id           : parseInt(category_id),
        prix_initial          : parseFloat(prix_initial),
        jours_avant_expiration: parseInt(jours_avant_expiration),
        stock                 : parseInt(stock)
      },
      { timeout: 5000 }
    );

    const d = response.data;

    // ✅ CORRECTION : lire les bons champs retournés par Flask
    res.json({
      success       : true,
      prix_suggere  : d.prix_suggere,    // ✅ était d.prix_optimal
      reduction_pct : d.reduction_pct,   // ✅ était d.reduction_pourcentage
      recommandation: d.recommandation,
      modele        : d.modele
    });

  } catch (error) {
    console.error('Erreur suggestion IA:', error.message);
    res.status(500).json({
      success: false,
      error: 'IA indisponible. Démarrez Flask sur le port 5001.'
    });
  }
});

// ✅ Créer un produit (SUPERMARCHÉ uniquement)
router.post('/', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const productData = { user_id: req.user.id, ...req.body };
    const product = await Product.create(productData);
    res.status(201).json({ message: 'Produit créé avec succès', product });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

// ✅ Mes produits (SUPERMARCHÉ connecté)
router.get('/my-products', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const products = await Product.findByUserId(req.user.id);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// ✅ Tous les produits disponibles (CONSOMMATEURS)
router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll(req.query);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// ✅ Produit par ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

// ✅ Modifier un produit
router.put('/:id', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    if (product.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });

    const updated = await Product.update(req.params.id, req.body);
    res.json({ message: 'Produit mis à jour avec succès', product: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
});

// ✅ Supprimer un produit
router.delete('/:id', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    if (product.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });

    await Product.delete(req.params.id);
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

// ✅ Mise à jour manuelle des prix par IA
router.post('/update-prices', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const startTime = Date.now();
    const result = await PricingEngine.updateAllProductsPrices(pool);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.json({
      success: true,
      message: 'Prix mis à jour avec succès',
      data: {
        produits_mis_a_jour: result.updated,
        calculés_par_ia    : result.usedIA,
        calculés_par_regles: result.usedRules,
        produits_expirés   : result.expired || 0,
        durée_secondes     : parseFloat(duration),
        timestamp          : new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour des prix', details: error.message });
  }
});

// ✅ Statistiques des prix
router.get('/pricing-stats', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_produits,
        AVG(prix_initial) as prix_moyen_initial,
        AVG(prix_reduit) as prix_moyen_reduit,
        AVG((prix_initial - prix_reduit) / prix_initial * 100) as reduction_moyenne_pct,
        SUM(CASE WHEN jours_avant_expiration <= 2 THEN 1 ELSE 0 END) as produits_urgents,
        SUM(CASE WHEN jours_avant_expiration BETWEEN 3 AND 5 THEN 1 ELSE 0 END) as produits_attention,
        SUM(CASE WHEN jours_avant_expiration > 5 THEN 1 ELSE 0 END) as produits_bon_etat
      FROM products 
      WHERE user_id = ? AND statut != 'expire'
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        total_produits    : stats[0].total_produits,
        prix_moyen_initial: parseFloat(stats[0].prix_moyen_initial || 0).toFixed(3),
        prix_moyen_reduit : parseFloat(stats[0].prix_moyen_reduit  || 0).toFixed(3),
        reduction_moyenne : parseFloat(stats[0].reduction_moyenne_pct || 0).toFixed(1) + '%',
        urgence: {
          urgent   : stats[0].produits_urgents,
          attention: stats[0].produits_attention,
          bon_etat : stats[0].produits_bon_etat
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router;