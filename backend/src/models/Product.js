const pool = require('../config/database');

class Product {

  // ══ CRÉER UN PRODUIT ══
  static async create(productData) {
    const {
      user_id,
      category_id,
      nom,
      marque,           // ✅ AJOUTÉ
      description,
      prix_initial,
      prix_reduit,
      stock,
      date_expiration,
      image_url
    } = productData;

    const today          = new Date();
    const expirationDate = new Date(date_expiration);
    const diffTime       = expirationDate - today;
    const jours_avant_expiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let statut = 'disponible';
    if      (jours_avant_expiration <= 0) statut = 'expire';
    else if (jours_avant_expiration <= 2) statut = 'urgent';
    else if (jours_avant_expiration <= 5) statut = 'attention';

    const [result] = await pool.query(
      `INSERT INTO products 
       (user_id, category_id, nom, marque, description, prix_initial, prix_reduit,
        stock, date_expiration, jours_avant_expiration, statut, image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        category_id,
        nom,
        marque       || null,   // ✅
        description  || null,
        prix_initial,
        prix_reduit  || null,
        stock,
        date_expiration,
        jours_avant_expiration,
        statut,
        image_url    || null
      ]
    );

    return {
      id: result.insertId,
      user_id,
      category_id,
      nom,
      marque           : marque      || null,  // ✅
      prix_initial,
      prix_reduit      : prix_reduit || null,
      stock,
      date_expiration,
      jours_avant_expiration,
      statut,
      image_url
    };
  }

  // ══ MODIFIER UN PRODUIT ══
  static async update(id, productData) {
    const {
      nom,
      marque,           // ✅ AJOUTÉ
      category_id,
      description,
      prix_initial,
      prix_reduit,
      stock,
      date_expiration,
      statut,
      image_url
    } = productData;

    const today          = new Date();
    const expirationDate = new Date(date_expiration);
    const diffTime       = expirationDate - today;
    const jours_avant_expiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    await pool.query(
      `UPDATE products 
       SET nom                    = ?,
           marque                 = ?,
           category_id            = ?,
           description            = ?,
           prix_initial           = ?,
           prix_reduit            = ?,
           stock                  = ?,
           date_expiration        = ?,
           jours_avant_expiration = ?,
           statut                 = ?,
           image_url              = ?,
           date_modification      = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nom,
        marque      || null,   // ✅
        category_id,
        description || null,
        prix_initial,
        prix_reduit || null,
        stock,
        date_expiration,
        jours_avant_expiration,
        statut,
        image_url   || null,
        id
      ]
    );

    return await this.findById(id);
  }

  // ══ TROUVER PAR ID ══
  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT p.*,
              p.marque,
              c.nom  AS categorie_nom,
              u.nom  AS supermarche_user_nom,
              s.nom_magasin,
              s.description  AS supermarche_description,
              s.adresse      AS supermarche_adresse,
              s.ville        AS supermarche_ville,
              s.telephone    AS supermarche_telephone,
              s.image_url    AS supermarche_image,
              s.latitude     AS supermarche_latitude,
              s.longitude    AS supermarche_longitude
       FROM products p
       LEFT JOIN categories  c ON p.category_id = c.id
       LEFT JOIN users       u ON p.user_id     = u.id
       LEFT JOIN supermarkets s ON p.user_id    = s.user_id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0];
  }

  // ══ TROUVER PAR USER ══
  static async findByUserId(user_id) {
    const [rows] = await pool.query(
      `SELECT p.*, p.marque, c.nom AS categorie_nom 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.user_id = ?
       ORDER BY p.date_expiration ASC`,
      [user_id]
    );
    return rows;
  }

  // ══ TROUVER TOUS (avec filtres optionnels) ══
  static async findAll(filters = {}) {
    let query = `
      SELECT
        p.*,
        p.marque,
        c.nom          AS categorie_nom,
        u.nom          AS supermarche_user_nom,
        s.id           AS supermarche_id,
        s.nom_magasin,
        s.description  AS supermarche_description,
        s.adresse      AS supermarche_adresse,
        s.ville        AS supermarche_ville,
        s.telephone    AS supermarche_telephone,
        s.image_url    AS supermarche_image,
        s.latitude     AS supermarche_latitude,
        s.longitude    AS supermarche_longitude
      FROM products p
      LEFT JOIN categories   c ON p.category_id = c.id
      LEFT JOIN users        u ON p.user_id     = u.id
      LEFT JOIN supermarkets s ON p.user_id     = s.user_id
      WHERE p.statut IN ('disponible', 'urgent', 'attention')
      AND   p.stock > 0
    `;

    const params = [];

    if (filters.category_id) {
      query += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }

    if (filters.marque) {
      query += ' AND p.marque = ?';
      params.push(filters.marque);
    }

    if (filters.ville) {
      query += ' AND s.ville = ?';
      params.push(filters.ville);
    }

    query += ' ORDER BY p.jours_avant_expiration ASC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  // ══ SUPPRIMER ══
  static async delete(id) {
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
  }

  // ══ CATÉGORIES ══
  static async getCategories() {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM categories ORDER BY id ASC'
      );
      return rows;
    } catch (error) {
      console.error('Erreur SQL getCategories:', error);
      throw error;
    }
  }
}

module.exports = Product;