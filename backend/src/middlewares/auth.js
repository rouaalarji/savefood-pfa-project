const jwt = require('jsonwebtoken');

// Vérifier le token JWT
const authMiddleware = (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Token manquant. Veuillez vous connecter.' });
    }
    
    // Format attendu: "Bearer TOKEN"
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Format de token invalide' });
    }
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ajouter les infos de l'utilisateur à la requête
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré. Veuillez vous reconnecter.' });
    }
    return res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

// Vérifier que l'utilisateur est un supermarché
const isSupermarket = (req, res, next) => {
  if (req.user.role !== 'supermarche') {
    return res.status(403).json({ error: 'Accès refusé. Réservé aux supermarchés.' });
  }
  next();
};

// Vérifier que l'utilisateur est un consommateur
const isConsumer = (req, res, next) => {
  if (req.user.role !== 'consommateur') {
    return res.status(403).json({ error: 'Accès refusé. Réservé aux consommateurs.' });
  }
  next();
};

module.exports = { authMiddleware, isSupermarket, isConsumer };