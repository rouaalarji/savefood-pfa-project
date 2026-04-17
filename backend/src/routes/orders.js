const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const { authMiddleware, isSupermarket, isConsumer } = require('../middlewares/auth');

// ── Créer une réservation unitaire (route simple) ──
router.post('/', authMiddleware, isConsumer, async (req, res) => {
  try {
    const order = await Order.create({
      user_id   : req.user.id,
      product_id: req.body.product_id,
      quantite  : req.body.quantite || 1,
    });
    res.status(201).json({ message: 'Réservation créée avec succès', order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// ✅ ROUTE PANIER — crée UNE commande groupée PAR supermarché
//
// POST /api/orders/group-by-supermarket
// Body: {
//   groups: [
//     { supermarket_id: 1, items: [{ product_id, quantite }, ...] },
//     { supermarket_id: 2, items: [{ product_id, quantite }, ...] },
//   ]
// }
//
// Retourne: {
//   results: [
//     { supermarket_id, group_id, orders: [...] },
//     { supermarket_id, group_id, orders: [...] },
//   ]
// }
// ══════════════════════════════════════════════════════════
router.post('/group-by-supermarket', authMiddleware, isConsumer, async (req, res) => {
  try {
    const { groups } = req.body;

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Aucun groupe de produits fourni' });
    }

    const results = [];

    // Créer une commande groupée PAR supermarché (group_id différent pour chaque)
    for (const group of groups) {
      const { items } = group;
      if (!items || items.length === 0) continue;

      const result = await Order.createGroup(req.user.id, items);
      results.push({
        supermarket_id: group.supermarket_id,
        group_id      : result.group_id,
        orders        : result.orders,
      });
    }

    const totalOrders = results.reduce((acc, r) => acc + r.orders.length, 0);

    res.status(201).json({
      message: `${totalOrders} réservation(s) créée(s) en ${results.length} commande(s)`,
      results,
    });
  } catch (error) {
    console.error('Erreur commande groupée:', error);
    res.status(400).json({ error: error.message });
  }
});

// ── Mes réservations (consommateur) ──
router.get('/my-orders', authMiddleware, isConsumer, async (req, res) => {
  try {
    const orders = await Order.findByUserId(req.user.id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

// ── Réservations du supermarché ──
router.get('/supermarket-orders', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const orders = await Order.findBySupermarketId(req.user.id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

// ── Récupérer une réservation par ID ──
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Réservation non trouvée' });
    if (req.user.role === 'consumer'    && order.user_id        !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
    if (req.user.role === 'supermarket' && order.supermarket_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ── Confirmer retrait (supermarché) ──
router.patch('/:id/confirm', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const { code_recuperation } = req.body;
    if (!code_recuperation) return res.status(400).json({ error: 'Code de récupération requis' });
    const order = await Order.confirm(req.params.id, code_recuperation);
    res.json({ message: 'Retrait confirmé avec succès', order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── Confirmer livraison + facture (supermarché) ──
router.patch('/:id/deliver', authMiddleware, isSupermarket, async (req, res) => {
  try {
    const { order, facture } = await Order.confirmAndDeliver(req.params.id, req.user.id);
    res.json({ message: 'Livraison confirmée avec succès', order, facture });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── Annuler une réservation ──
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.cancel(req.params.id, req.user.id, req.user.role);
    res.json({ message: 'Réservation annulée avec succès', order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;