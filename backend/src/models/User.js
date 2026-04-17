const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { nom, prenom, email, password, role, telephone, adresse, ville, latitude, longitude } = userData;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (nom, prenom, email, password, role, telephone, adresse, ville, latitude, longitude) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        prenom      || null,
        email,
        hashedPassword,
        role,
        telephone   || null,
        adresse     || null,
        ville       || null,
        latitude    || null,
        longitude   || null,
      ]
    );

    return {
      id: result.insertId,
      nom, prenom, email, role,
      telephone, adresse, ville,
      latitude, longitude,
    };
  }

  static async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async update(id, userData) {
    const { nom, prenom, telephone, adresse, ville, latitude, longitude } = userData;

    await pool.query(
      `UPDATE users 
       SET nom = ?, prenom = ?, telephone = ?, adresse = ?, ville = ?,
           latitude = ?, longitude = ?
       WHERE id = ?`,
      [nom, prenom, telephone, adresse, ville, latitude || null, longitude || null, id]
    );

    return await this.findById(id);
  }
}

module.exports = User;