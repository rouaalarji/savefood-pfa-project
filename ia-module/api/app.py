from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# ============================================================
# CHARGEMENT DU MODÈLE
# ============================================================
print("🔄 Chargement du modèle IA...")
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MODEL_DIR = os.path.join(BASE_DIR, '..', 'models')

    with open(os.path.join(MODEL_DIR, 'price_model.pkl'), 'rb') as f:
        model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'label_encoder.pkl'), 'rb') as f:
        label_encoder = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'metrics.pkl'), 'rb') as f:
        metrics = pickle.load(f)

    model_type = type(model).__name__

    #  Afficher les catégories connues pour déboguer
    classes_connues = list(label_encoder.classes_)
    print(f"✅ Modèle chargé avec succès !")
    print(f"   Type      : {model_type}")
    print(f"   Précision : {metrics['r2']*100:.2f}%")
    print(f"   MAE       : {metrics['mae']:.4f} TND")
    print(f"   Catégories connues : {classes_connues}")

except FileNotFoundError as e:
    print(f"❌ ERREUR : Fichier non trouvé → {e}")
    print("   Exécutez Entrainement_modeles.py d'abord !")
    model = label_encoder = metrics = model_type = None
    classes_connues = []

# ============================================================
# MAPPING catégorie_id → nom
# ⚠️ Doit correspondre EXACTEMENT aux noms dans le dataset
# ============================================================
CATEGORY_MAPPING = {
    1: 'Produits Laitiers',
    2: 'Fruits et Légumes',
    3: 'Boulangerie',
    4: 'Viandes et Poissons',
    5: 'Épicerie',
    6: 'Surgelés'
}

# ============================================================
# ROUTES
# ============================================================

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'service'   : 'API IA - Anti-Gaspillage',
        'status'    : 'OK' if model else 'ERROR',
        'version'   : '3.0',
        'modele'    : model_type,
        'precision' : f"{metrics['r2']*100:.2f}%" if metrics else 'N/A',
        'categories': classes_connues
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status'        : 'healthy' if model else 'unhealthy',
        'model_loaded'  : model is not None,
        'encoder_loaded': label_encoder is not None,
        'model_type'    : model_type,
        'categories'    : classes_connues
    })

@app.route('/metrics', methods=['GET'])
def get_metrics():
    if not metrics:
        return jsonify({'error': 'Métriques non disponibles'}), 500
    return jsonify({
        'r2_score'     : round(float(metrics['r2']), 4),
        'precision_pct': round(float(metrics['r2']) * 100, 2),
        'mae'          : round(float(metrics['mae']), 4),
        'rmse'         : round(float(metrics['rmse']), 4),
        'mape'         : round(float(metrics['mape']), 2),
        'n_train'      : int(metrics['n_train']),
        'n_test'       : int(metrics['n_test']),
        'modele'       : model_type
    })

@app.route('/predict-price', methods=['POST'])
def predict_price():
    if not model or not label_encoder:
        return jsonify({'error': 'Modèle IA non disponible'}), 500

    try:
        data = request.get_json()

        # ── Validation des champs requis ──
        required = ['category_id', 'prix_initial', 'jours_avant_expiration', 'stock']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Champ manquant : {field}'}), 400

        category_id            = int(data['category_id'])
        prix_initial           = float(data['prix_initial'])
        jours_avant_expiration = int(data['jours_avant_expiration'])
        stock                  = int(data['stock'])

        if prix_initial <= 0:
            return jsonify({'error': 'prix_initial doit être > 0'}), 400

        # ── Cas produit expiré ──
        if jours_avant_expiration <= 0:
            return jsonify({
                'prix_suggere'          : 0.0,
                'prix_initial'          : float(prix_initial),
                'reduction'             : float(prix_initial),
                'reduction_pct'         : 100.0,
                'jours_avant_expiration': 0,
                'recommandation'        : '🔴 EXPIRÉ - Retirer du stock',
                'source'                : 'regle',
                'modele'                : 'N/A'
            })

        # ── Résoudre le nom de catégorie ──
        category_name = CATEGORY_MAPPING.get(category_id, None)

        #  Vérifier que la catégorie existe dans l'encodeur
        if category_name not in classes_connues:
            print(f"⚠️  Catégorie '{category_name}' inconnue → fallback sur '{classes_connues[0]}'")
            category_name = classes_connues[0]

        #  Encoder la catégorie
        category_encoded = int(label_encoder.transform([category_name])[0])

        # ── Préparer les features ──
        features = np.array([[
            category_encoded,
            prix_initial,
            jours_avant_expiration,
            stock
        ]], dtype=float)

        # ── Prédiction ──
        raw_prediction = model.predict(features)[0]

        #  CORRECTION PRINCIPALE : convertir numpy float32 → float Python natif
        prix_optimal = float(raw_prediction)
        prix_optimal = round(prix_optimal, 3)

        # Bornes de sécurité
        prix_optimal = max(prix_optimal, round(prix_initial * 0.20, 3))  # min 20%
        prix_optimal = min(prix_optimal, prix_initial)                    # max = prix initial

        # ── Calcul réduction ──
        reduction     = round(float(prix_initial - prix_optimal), 3)
        reduction_pct = round(float((reduction / prix_initial) * 100), 1)

        # ── Recommandation ──
        if jours_avant_expiration <= 1:
            reco = f"🔴 URGENT : Réduction de {reduction_pct:.0f}% recommandée"
        elif jours_avant_expiration <= 3:
            reco = f"🟠 ATTENTION : Réduction de {reduction_pct:.0f}% pour accélérer les ventes"
        elif jours_avant_expiration <= 7:
            reco = f"🟡 Bonne affaire : Réduction modérée de {reduction_pct:.0f}%"
        else:
            reco = f"🟢 Produit frais : Réduction légère de {reduction_pct:.0f}%"

        print(f"✅ Prédiction: {category_name} | {prix_initial} → {prix_optimal} TND (-{reduction_pct}%)")

        #  Tous les champs sont des types Python natifs (float, int, str)
        return jsonify({
            'prix_suggere'          : float(prix_optimal),
            'prix_initial'          : float(prix_initial),
            'reduction'             : float(reduction),
            'reduction_pct'         : float(reduction_pct),
            'categorie'             : str(category_name),
            'jours_avant_expiration': int(jours_avant_expiration),
            'recommandation'        : str(reco),
            'source'                : 'ia',
            'modele'                : str(model_type)
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Erreur : {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    if not model:
        print("\n⚠️  ATTENTION : Le modèle n'est pas chargé !")
        print("➡️  Exécutez : python Entrainement_modeles.py\n")

    print(f"\n🚀 Démarrage API IA sur http://localhost:5001")
    print(f"   Modèle actif : {model_type}\n")

    app.run(host='0.0.0.0', port=5001, debug=True)