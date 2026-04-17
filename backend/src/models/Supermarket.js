const pool = require('../config/database');

class Supermarket {

  static async findByUserId(user_id) {
    const [rows] = await pool.query(
      'SELECT * FROM supermarkets WHERE user_id = ?',
      [user_id]
    );
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT s.*, u.email 
       FROM supermarkets s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async createOrUpdate(user_id, data) {
    const { 
      nom_magasin, 
      description, 
      adresse, 
      ville, 
      telephone, 
      image_url,
      latitude,
      longitude
    } = data;

    const existing = await this.findByUserId(user_id);

    if (existing) {
      // UPDATE
      await pool.query(
        `UPDATE supermarkets 
         SET nom_magasin = ?, description = ?, adresse = ?,
             ville = ?, telephone = ?, image_url = ?,
             latitude = ?, longitude = ?,
             date_modification = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          nom_magasin, 
          description || null, 
          adresse || null,
          ville || null, 
          telephone || null, 
          image_url || null,
          latitude || null, 
          longitude || null, 
          user_id
        ]
      );
    } else {
      // INSERT
      await pool.query(
        `INSERT INTO supermarkets 
         (user_id, nom_magasin, description, adresse, ville, telephone, image_url, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id, 
          nom_magasin, 
          description || null, 
          adresse || null,
          ville || null, 
          telephone || null, 
          image_url || null,
          latitude || null, 
          longitude || null
        ]
      );
    }

    return await this.findByUserId(user_id);
  }
}

module.exports = Supermarket;