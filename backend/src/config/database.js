const mysql = require('mysql2/promise');
//permet de lire les variables dans un fichier .env
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Tester la connexion
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(' Connexion à MySQL  réussie');
    connection.release();
  } catch (error) {
    console.error(' Erreur de connexion à MySQL:', error.message);
  }
})();

module.exports = pool;