const pool = require('../config/database');

class Order {
  // Générer un code de retrait unique
  static generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'ORD';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Créer une réservation
  static async create(orderData) {
    const { user_id, product_id, quantite } = orderData;
    
    try {
      // 1. Vérifier que le produit existe et a du stock
      const [product] = await pool.query(
    'SELECT * FROM products WHERE id = ? AND statut IN ("disponible", "urgent", "attention")',
        [product_id]
      );

      if (product.length === 0) {
        throw new Error('Produit non disponible');
      }

      if (product[0].stock < quantite) {
        throw new Error(`Stock insuffisant. Disponible: ${product[0].stock}`);
      }

      // 2. Générer un code unique
      let code_recuperation = this.generateCode();
      let codeExists = true;
      
      while (codeExists) {
        const [existing] = await pool.query(
          'SELECT id FROM orders WHERE code_recuperation = ?',
          [code_recuperation]
        );
        if (existing.length === 0) {
          codeExists = false;
        } else {
          code_recuperation = this.generateCode();
        }
      }

      // 3. Calculer les prix
      const prix_unitaire = product[0].prix_reduit || product[0].prix_initial;
      const prix_total = prix_unitaire * quantite;

      // 4. Créer la commande
      const [result] = await pool.query(
        `INSERT INTO orders (user_id, product_id, quantite, prix_unitaire, prix_total, code_recuperation, statut)
         VALUES (?, ?, ?, ?, ?, ?, 'en_attente')`,
        [user_id, product_id, quantite, prix_unitaire, prix_total, code_recuperation]
      );

      // 5. Décrémenter le stock
      await pool.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [quantite, product_id]
      );

      // 6. Retourner la commande créée
      const [newOrder] = await pool.query(
        `SELECT o.*, p.nom as produit_nom, p.image_url, u.nom as client_nom, u.prenom as client_prenom, u.telephone as client_telephone
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.id = ?`,
        [result.insertId]
      );

      return newOrder[0];
    } catch (error) {
      throw error;
    }
  }

  // Récupérer les commandes d'un consommateur
  static async findByUserId(user_id) {
    const [rows] = await pool.query(
      `SELECT o.*, p.nom as produit_nom, p.image_url, p.date_expiration,
              u.nom as supermarket_nom, u.telephone as supermarket_tel
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN users u ON p.user_id = u.id
       WHERE o.user_id = ?
       ORDER BY o.date_reservation DESC`,
      [user_id]
    );
    return rows;
  }

  // Récupérer les commandes d'un supermarché
  static async findBySupermarketId(supermarket_id) {
  const [rows] = await pool.query(
    `SELECT o.*, p.nom as produit_nom, p.image_url,
            u.nom         AS client_nom,
            u.prenom      AS client_prenom,
            u.telephone   AS client_telephone,
            u.email       AS client_email,
            u.adresse     AS client_adresse,
            u.ville       AS client_ville
     FROM orders o
     LEFT JOIN products p ON o.product_id = p.id
     LEFT JOIN users u ON o.user_id = u.id
     WHERE p.user_id = ?
     ORDER BY o.date_reservation DESC`,
    [supermarket_id]
  );
  return rows;
}

  // Récupérer une commande par ID
  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT o.*, p.nom as produit_nom, p.image_url, p.user_id as supermarket_id,
              u.nom as client_nom, u.prenom as client_prenom
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );
    return rows[0];
  }

  // Confirmer le retrait (supermarché)
  static async confirm(id, code_recuperation) {
    try {
      // Vérifier que le code est correct
      const order = await this.findById(id);
      
      if (!order) {
        throw new Error('Commande non trouvée');
      }

      if (order.statut !== 'en_attente') {
        throw new Error('Cette commande a déjà été traitée');
      }

      if (order.code_recuperation !== code_recuperation) {
        throw new Error('Code de récupération invalide');
      }

      // Mettre à jour la commande
      await pool.query(
        `UPDATE orders 
         SET statut = 'recuperee', date_recuperation = NOW()
         WHERE id = ?`,
        [id]
      );

      // Mettre à jour le statut du produit si stock = 0
      await pool.query(
        `UPDATE products 
         SET statut = CASE 
           WHEN stock = 0 THEN 'vendu'
           ELSE statut
         END
         WHERE id = ?`,
        [order.product_id]
      );

      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }
// ══ NOUVELLE MÉTHODE : Confirmer livraison + infos client + facture ══
  static async confirmAndDeliver(id, supermarket_user_id) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          o.id, o.quantite, o.prix_unitaire, o.prix_total,
          o.code_recuperation, o.statut, o.date_reservation, o.product_id,
          u.id          AS client_id,
          u.nom         AS client_nom,
          u.prenom      AS client_prenom,
          u.email       AS client_email,
          u.telephone   AS client_telephone,
          u.adresse     AS client_adresse,
          u.ville       AS client_ville,
          p.nom         AS produit_nom,
          p.prix_initial,
          p.prix_reduit,
          p.image_url,
          s.nom_magasin,
          s.adresse     AS supermarche_adresse,
          s.ville       AS supermarche_ville,
          s.telephone   AS supermarche_telephone
         FROM orders o
         JOIN users u       ON o.user_id    = u.id
         JOIN products p    ON o.product_id = p.id
         JOIN supermarkets s ON p.user_id   = s.user_id
         WHERE o.id = ? AND p.user_id = ?`,
        [id, supermarket_user_id]
      );

      if (rows.length === 0) throw new Error('Commande introuvable ou non autorisée');

      const order = rows[0];

      if (order.statut === 'en_cours_livraison') throw new Error('Commande déjà confirmée');
      if (order.statut === 'annulee') throw new Error('Impossible de confirmer une commande annulée');
      if (order.statut === 'recuperee') throw new Error('Commande déjà récupérée');

      // 1. Changer statut
      await pool.query(
        `UPDATE orders SET statut = 'en_cours_livraison', updated_at = NOW() WHERE id = ?`,
        [id]
      );

      // 2. Notification in-app pour le client
      const message = ` Votre commande "${order.produit_nom}" (code : ${order.code_recuperation}) est en cours de livraison !`;
      await pool.query(
        `INSERT INTO notifications (user_id, order_id, type, message, is_read, created_at)
         VALUES (?, ?, 'livraison', ?, 0, NOW())`,
        [order.client_id, id, message]
      );

      // 3. Construire la facture
      const facture = {
        numero : `FAC-${String(id).padStart(6, '0')}`,
        date   : new Date().toLocaleDateString('fr-TN'),
        client: {
          nom       : `${order.client_prenom} ${order.client_nom}`,
          email     : order.client_email,
          telephone : order.client_telephone || '—',
          adresse   : order.client_adresse   || '—',
          ville     : order.client_ville     || '—',
        },
        produit: {
          nom           : order.produit_nom,
          quantite      : order.quantite,
          prix_unitaire : parseFloat(order.prix_unitaire).toFixed(3),
          prix_initial  : parseFloat(order.prix_initial).toFixed(3),
          prix_total    : parseFloat(order.prix_total).toFixed(3),
        },
        supermarche: {
          nom       : order.nom_magasin,
          adresse   : order.supermarche_adresse  || '—',
          ville     : order.supermarche_ville    || '—',
          telephone : order.supermarche_telephone || '—',
        },
        code_recuperation: order.code_recuperation,
      };

      return { order: { ...order, statut: 'en_cours_livraison' }, facture };
    } catch (error) {
      throw error;
    }
  }

  // Annuler une commande
  static async cancel(id, user_id, role) {
    try {
      const order = await this.findById(id);

      if (!order) {
        throw new Error('Commande non trouvée');
      }

      // Vérifier les permissions
      if (role === 'consumer' && order.user_id !== user_id) {
        throw new Error('Non autorisé');
      }
      if (role === 'supermarket' && order.supermarket_id !== user_id) {
        throw new Error('Non autorisé');
      }

      if (order.statut === 'recuperee') {
        throw new Error('Impossible d\'annuler une commande déjà récupérée');
      }

      // Remettre le stock
      if (order.statut === 'en_attente') {
        await pool.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [order.quantite, order.product_id]
        );
      }

      // Annuler la commande
      await pool.query(
        'UPDATE orders SET statut = "annulee" WHERE id = ?',
        [id]
      );

      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  // Supprimer une commande (admin uniquement)
  static async delete(id) {
    await pool.query('DELETE FROM orders WHERE id = ?', [id]);
    return true;
  }
}

module.exports = Order;