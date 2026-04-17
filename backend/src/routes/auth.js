const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const pool = require('../config/database');
const Supermarket = require('../models/Supermarket');

// ══ INSCRIPTION ══
router.post('/register', async (req, res) => {
  try {
    // ✅ latitude et longitude ajoutés
    const { nom, prenom, email, password, role, telephone, adresse, ville, latitude, longitude } = req.body;

    if (!nom || !email || !password || !role) {
      return res.status(400).json({ error: 'Les champs nom, email, password et role sont requis' });
    }

    if (!['supermarche', 'consommateur'].includes(role)) {
      return res.status(400).json({ error: 'Le rôle doit être "supermarche" ou "consommateur"' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // ✅ latitude et longitude passés à User.create
    const newUser = await User.create({ nom, prenom, email, password, role, telephone, adresse, ville, latitude, longitude });

    if (role === 'supermarche') {
      // ✅ latitude et longitude enregistrés aussi dans supermarkets
      await pool.query(
        `INSERT INTO supermarkets (user_id, nom_magasin, adresse, ville, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)`,
        [newUser.id, `${nom} - Magasin`, adresse || null, ville || null, latitude || null, longitude || null]
      );
    }

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        id        : newUser.id,
        nom       : newUser.nom,
        prenom    : newUser.prenom,
        email     : newUser.email,
        role      : newUser.role,
        telephone : newUser.telephone,
        adresse   : newUser.adresse,
        ville     : newUser.ville,
        latitude  : newUser.latitude,   // ✅ AJOUTÉ
        longitude : newUser.longitude,  // ✅ AJOUTÉ
      }
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// ══ CONNEXION ══
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      return res.status(403).json({ error: 'Votre compte a été désactivé.' });
    }

    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id        : user.id,
        nom       : user.nom,
        prenom    : user.prenom,
        email     : user.email,
        role      : user.role,
        telephone : user.telephone,
        adresse   : user.adresse,
        ville     : user.ville,
        latitude  : user.latitude,   // ✅ AJOUTÉ
        longitude : user.longitude,  // ✅ AJOUTÉ
      }
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ══ PROFIL UTILISATEUR ══
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    res.json({
      user: {
        id        : user.id,
        nom       : user.nom,
        prenom    : user.prenom,
        email     : user.email,
        role      : user.role,
        telephone : user.telephone,
        adresse   : user.adresse,
        ville     : user.ville,
        latitude  : user.latitude,   // ✅ AJOUTÉ
        longitude : user.longitude,  // ✅ AJOUTÉ
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// ══ MISE À JOUR PROFIL CONSOMMATEUR ══
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // ✅ req.body contient maintenant latitude et longitude depuis Profile.jsx
    const updated = await User.update(decoded.id, req.body);

    res.json({
      message: 'Profil mis à jour',
      user: {
        id        : updated.id,
        nom       : updated.nom,
        prenom    : updated.prenom,
        email     : updated.email,
        role      : updated.role,
        telephone : updated.telephone,
        adresse   : updated.adresse,
        ville     : updated.ville,
        latitude  : updated.latitude,   // ✅ AJOUTÉ
        longitude : updated.longitude,  // ✅ AJOUTÉ
      }
    });
  } catch (error) {
    console.error('UPDATE PROFILE ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══ GET PROFIL SUPERMARCHÉ ══
router.get('/supermarket-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const profile = await Supermarket.findByUserId(decoded.id);

    res.json({ profile: profile || null });
  } catch (error) {
    res.status(500).json({ error: 'Erreur récupération profil supermarché' });
  }
});

// ══ UPDATE PROFIL SUPERMARCHÉ ══
router.put('/supermarket-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // ✅ req.body contient latitude et longitude depuis SupermarketProfile.jsx
    const updated = await Supermarket.createOrUpdate(decoded.id, req.body);

    res.json({ message: 'Profil supermarché mis à jour', profile: updated });
  } catch (error) {
    console.error('UPDATE SUPERMARKET PROFILE ERROR:', error);
    res.status(500).json({ error: 'Erreur mise à jour profil supermarché' });
  }
});

// ══ CHECK PROFIL SUPERMARCHÉ COMPLÉTÉ ══
router.get('/supermarket-profile-status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const profile = await Supermarket.findByUserId(decoded.id);

    const isComplete = profile &&
      profile.nom_magasin &&
      profile.ville &&
      profile.adresse &&
      profile.telephone;

    res.json({
      has_profile : !!profile,
      is_complete : !!isComplete,
      profile     : profile || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur vérification profil' });
  }
});

// ══ SAUVEGARDER GÉOLOCALISATION GPS (bouton) ══
router.put('/supermarket-location', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude et longitude requis' });
    }

    await pool.query(
      `UPDATE supermarkets SET latitude = ?, longitude = ?, date_modification = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [latitude, longitude, decoded.id]
    );

    res.json({ message: 'Localisation sauvegardée', latitude, longitude });
  } catch (error) {
    console.error('UPDATE LOCATION ERROR:', error);
    res.status(500).json({ error: 'Erreur sauvegarde localisation' });
  }
});

module.exports = router;