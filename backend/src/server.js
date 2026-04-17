//crée une application Express (le backend)
const express = require('express');
const cors = require('cors');
//axios pour faire de requetes HTTP 
const axios = require("axios");
require('dotenv').config();
//Import des routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const notificationsRouter = require('./routes/notifications');
const app = express();
const PORT = process.env.PORT || 5000;
const recommendationsRouter = require('./routes/recommendations');
// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/notifications', notificationsRouter);

// Route test
app.get('/', (req, res) => {
  res.json({
    message: 'API Plateforme Anti-Gaspillage',
    status: 'OK'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/recommendations', recommendationsRouter);

// ✅ ROUTE ADDRESS (ICI AVANT listen)
app.get("/api/address", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.status(400).json({ error: "missing query" });
    }

    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          format: "json",
          q
        },
        headers: {
          "User-Agent": "PFA-App"
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "API error" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// START SERVER (TOUJOURS EN DERNIER)
app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});