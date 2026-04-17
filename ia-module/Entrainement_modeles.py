# ============================================================
#  COMPARAISON : Random Forest vs XGBoost + Bayesian Optimization

# ============================================================

import pandas as pd
import numpy as np
import os
import pickle
import time
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor
from skopt import BayesSearchCV
from skopt.space import Real, Integer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# 1. CHARGER LE DATASET
# ============================================================
df = pd.read_csv(os.path.join(BASE_DIR, 'dataset_complet.csv'), encoding='utf-8-sig')
print(f"Dataset chargé : {len(df)} lignes")

# ============================================================
# 2. ENCODER LA CATÉGORIE
# ============================================================
le = LabelEncoder()
df['categorie_encoded'] = le.fit_transform(df['categorie'])
print(f"Catégories : {dict(zip(le.classes_, le.transform(le.classes_)))}")

# ============================================================
# 3. FEATURES ET TARGET
# ============================================================
FEATURES = ['categorie_encoded', 'prix_initial', 'jours_avant_expiration', 'stock']
TARGET   = 'prix_optimal'

X = df[FEATURES]
y = df[TARGET]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"\nTrain : {len(X_train)} lignes")
print(f"Test  : {len(X_test)} lignes")

# ============================================================
# 4. MODÈLE 1 — RANDOM FOREST (inchangé)
# ============================================================
print("\n" + "="*55)
print(" ENTRAÎNEMENT — Random Forest")
print("="*55)

debut = time.time()
rf = RandomForestRegressor(
    n_estimators=150,
    max_depth=None,
    min_samples_split=2,
    random_state=42,
    n_jobs=-1
)
rf.fit(X_train, y_train)
temps_rf = time.time() - debut

pred_rf  = rf.predict(X_test)
r2_rf    = r2_score(y_test, pred_rf)
mae_rf   = mean_absolute_error(y_test, pred_rf)
rmse_rf  = np.sqrt(mean_squared_error(y_test, pred_rf))

print(f"Entraîné en {temps_rf:.2f} secondes")
print(f"  R²   : {r2_rf*100:.2f}%")
print(f"  MAE  : {mae_rf:.4f} TND")
print(f"  RMSE : {rmse_rf:.4f} TND")

# ============================================================
# 5. MODÈLE 2 — XGBOOST + BAYESIAN OPTIMIZATION
# ============================================================
print("\n" + "="*55)
print(" ENTRAÎNEMENT — XGBoost + Bayesian Optimization")
print("="*55)
print(" Recherche des meilleurs hyperparamètres en cours...")
print(" (peut prendre 2-5 minutes selon la taille du dataset)")

# ── Espace de recherche des hyperparamètres ──
# BayesSearchCV explore intelligemment ces plages
# au lieu d'essayer toutes les combinaisons (GridSearch)
search_space = {
    'n_estimators'     : Integer(50, 500),       # nombre d'arbres
    'learning_rate'    : Real(0.01, 0.3, prior='log-uniform'),  # taux d'apprentissage
    'max_depth'        : Integer(3, 10),          # profondeur max des arbres
    'subsample'        : Real(0.5, 1.0),          # % de données par arbre
    'colsample_bytree' : Real(0.5, 1.0),          # % de features par arbre
    'min_child_weight' : Integer(1, 10),          # régularisation
    'gamma'            : Real(0, 5),              # seuil de split
    'reg_alpha'        : Real(0, 2),              # régularisation L1
    'reg_lambda'       : Real(0, 2),              # régularisation L2
}

xgb_base = XGBRegressor(random_state=42, verbosity=0)

# BayesSearchCV : 30 itérations d'optimisation bayésienne
# cv=5 : validation croisée 5 folds pour évaluer chaque combinaison
# scoring='neg_mean_absolute_error' : minimiser MAE
opt = BayesSearchCV(
    estimator  = xgb_base,
    search_spaces = search_space,
    n_iter     = 30,          # nombre d'évaluations bayésiennes
    cv         = 5,           # validation croisée 5 folds
    scoring    = 'neg_mean_absolute_error',
    n_jobs     = -1,
    random_state = 42,
    verbose    = 1
)

debut = time.time()
opt.fit(X_train, y_train)
temps_xgb = time.time() - debut

# Meilleur modèle trouvé
xgb = opt.best_estimator_
best_params = opt.best_params_

print(f"\nOptimisation terminée en {temps_xgb:.2f} secondes")
print(f"\nMeilleurs hyperparamètres trouvés :")
for param, val in best_params.items():
    print(f"  {param:<22} : {val}")

pred_xgb = xgb.predict(X_test)
r2_xgb   = r2_score(y_test, pred_xgb)
mae_xgb  = mean_absolute_error(y_test, pred_xgb)
rmse_xgb = np.sqrt(mean_squared_error(y_test, pred_xgb))

print(f"\nRésultats XGBoost optimisé :")
print(f"  R²   : {r2_xgb*100:.2f}%")
print(f"  MAE  : {mae_xgb:.4f} TND")
print(f"  RMSE : {rmse_xgb:.4f} TND")

# ============================================================
# 6. TABLEAU COMPARATIF
# ============================================================
print("\n" + "="*60)
print(" COMPARAISON FINALE")
print("="*60)
print(f"{'Métrique':<22} {'Random Forest':>16} {'XGBoost (Bayes)':>16}")
print("-"*60)
print(f"{'R² (précision)':<22} {r2_rf*100:>15.2f}% {r2_xgb*100:>15.2f}%")
print(f"{'MAE (TND)':<22} {mae_rf:>16.4f} {mae_xgb:>16.4f}")
print(f"{'RMSE (TND)':<22} {rmse_rf:>16.4f} {rmse_xgb:>16.4f}")
print(f"{'Temps (sec)':<22} {temps_rf:>16.2f} {temps_xgb:>16.2f}")
print("-"*60)

# ============================================================
# 7. CHOISIR LE MEILLEUR MODÈLE
# ============================================================
if mae_xgb <= mae_rf:
    meilleur_nom   = "XGBoost (Bayesian Optimization)"
    meilleur_model = xgb
    meilleur_r2    = r2_xgb
    meilleur_mae   = mae_xgb
    pred_meilleur  = pred_xgb
else:
    meilleur_nom   = "Random Forest"
    meilleur_model = rf
    meilleur_r2    = r2_rf
    meilleur_mae   = mae_rf
    pred_meilleur  = pred_rf

print(f"\nMEILLEUR MODÈLE : {meilleur_nom}")
print(f"  R²  : {meilleur_r2*100:.2f}%")
print(f"  MAE : {meilleur_mae:.4f} TND")

# ============================================================
# 8. SAUVEGARDER LE MEILLEUR MODÈLE + METRICS
# ============================================================
model_path   = os.path.join(BASE_DIR, 'price_model.pkl')
le_path      = os.path.join(BASE_DIR, 'label_encoder.pkl')
metrics_path = os.path.join(BASE_DIR, 'metrics.pkl')

with open(model_path, 'wb') as f:
    pickle.dump(meilleur_model, f)

with open(le_path, 'wb') as f:
    pickle.dump(le, f)

mape_val = float(
    np.mean(np.abs((y_test - pred_meilleur) / y_test)) * 100
)

metrics_data = {
    'r2'            : float(meilleur_r2),
    'mae'           : float(meilleur_mae),
    'rmse'          : float(np.sqrt(mean_squared_error(y_test, pred_meilleur))),
    'mape'          : round(mape_val, 2),
    'n_train'       : len(X_train),
    'n_test'        : len(X_test),
    'modele'        : meilleur_nom,
    'best_params'   : dict(best_params) if meilleur_nom.startswith('XGBoost') else {},
}

with open(metrics_path, 'wb') as f:
    pickle.dump(metrics_data, f)

print(f"\n3 fichiers sauvegardés :")
print(f"  → price_model.pkl")
print(f"  → label_encoder.pkl")
print(f"  → metrics.pkl")
print(f"\nCopie ces 3 fichiers dans : plateforme-anti-gaspillage\\models\\")

# ============================================================
# 9. TEST RAPIDE — simulation prédiction réelle
# ============================================================
print("\n" + "="*65)
print(" TEST — Prédictions sur exemples réels")
print("="*65)

exemples = [
    {'categorie': 'Fruits et Légumes',   'prix_initial': 2.000, 'jours': 1,  'stock': 50},
    {'categorie': 'Fruits et Légumes',   'prix_initial': 2.000, 'jours': 5,  'stock': 50},
    {'categorie': 'Produits Laitiers',   'prix_initial': 3.500, 'jours': 2,  'stock': 30},
    {'categorie': 'Produits Laitiers',   'prix_initial': 3.500, 'jours': 10, 'stock': 30},
    {'categorie': 'Viandes et Poissons', 'prix_initial': 12.00, 'jours': 1,  'stock': 15},
    {'categorie': 'Boulangerie',         'prix_initial': 1.500, 'jours': 1,  'stock': 40},
]

print(f"{'Catégorie':<22} {'Prix init':>10} {'Jours':>6} {'Prix prédit':>12} {'Réduction':>10}")
print("-"*65)

for ex in exemples:
    cat_enc = le.transform([ex['categorie']])[0]
    X_ex    = pd.DataFrame(
        [[cat_enc, ex['prix_initial'], ex['jours'], ex['stock']]],
        columns=FEATURES
    )
    pred  = meilleur_model.predict(X_ex)[0]
    reduc = (1 - pred / ex['prix_initial']) * 100
    print(f"{ex['categorie']:<22} {ex['prix_initial']:>10.3f} {ex['jours']:>6} {pred:>12.3f} {reduc:>9.1f}%")

# ============================================================
# 10. COURBES DE COMPARAISON VISUELLES
# ============================================================
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

fig = plt.figure(figsize=(18, 12))
fig.suptitle(
    'Comparaison Random Forest vs XGBoost (Bayesian Optimization)',
    fontsize=16, fontweight='bold', y=0.98
)
gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.4, wspace=0.35)

COLORS = {'rf': '#059669', 'xgb': '#2563eb', 'ideal': '#dc2626'}

# ── 1. R² ──
ax1 = fig.add_subplot(gs[0, 0])
bars = ax1.bar(
    ['Random Forest', 'XGBoost\n(Bayes)'],
    [r2_rf*100, r2_xgb*100],
    color=[COLORS['rf'], COLORS['xgb']], width=0.5, edgecolor='white', linewidth=1.5
)
for bar, val in zip(bars, [r2_rf*100, r2_xgb*100]):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
             f'{val:.2f}%', ha='center', va='bottom', fontweight='bold', fontsize=12)
ax1.set_ylim(0, 110)
ax1.set_ylabel('R² (%)', fontweight='bold')
ax1.set_title('Précision (R²)\nPlus haut = meilleur', fontweight='bold')
ax1.set_facecolor('#f8fafc')
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)

# ── 2. MAE ──
ax2 = fig.add_subplot(gs[0, 1])
bars2 = ax2.bar(
    ['Random Forest', 'XGBoost\n(Bayes)'],
    [mae_rf, mae_xgb],
    color=[COLORS['rf'], COLORS['xgb']], width=0.5, edgecolor='white', linewidth=1.5
)
for bar, val in zip(bars2, [mae_rf, mae_xgb]):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.001,
             f'{val:.4f}', ha='center', va='bottom', fontweight='bold', fontsize=12)
ax2.set_ylabel('MAE (TND)', fontweight='bold')
ax2.set_title('Erreur Moyenne (MAE)\nPlus bas = meilleur', fontweight='bold')
ax2.set_facecolor('#f8fafc')
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)

# ── 3. Convergence de l'optimisation bayésienne ──
ax3 = fig.add_subplot(gs[0, 2])
scores = -opt.cv_results_['mean_test_score']   # MAE à chaque itération
best_so_far = np.minimum.accumulate(scores)
ax3.plot(range(1, len(scores)+1), scores,
         'o-', color=COLORS['xgb'], alpha=0.5, markersize=4, label='MAE itération')
ax3.plot(range(1, len(best_so_far)+1), best_so_far,
         '-', color='#dc2626', linewidth=2.5, label='Meilleur jusqu\'ici')
ax3.set_xlabel('Itération', fontweight='bold')
ax3.set_ylabel('MAE (TND)', fontweight='bold')
ax3.set_title('Convergence Bayesian Optimization\nMAE par itération', fontweight='bold')
ax3.legend(fontsize=9)
ax3.set_facecolor('#f8fafc')
ax3.spines['top'].set_visible(False)
ax3.spines['right'].set_visible(False)

# ── 4. Réel vs Prédit — Random Forest ──
ax4 = fig.add_subplot(gs[1, 0])
ax4.scatter(y_test, pred_rf, alpha=0.4, color=COLORS['rf'], s=15)
lim = [min(y_test.min(), pred_rf.min()), max(y_test.max(), pred_rf.max())]
ax4.plot(lim, lim, '--', color=COLORS['ideal'], linewidth=2, label='Parfait')
ax4.set_xlabel('Prix réel (TND)', fontweight='bold')
ax4.set_ylabel('Prix prédit (TND)', fontweight='bold')
ax4.set_title(f'Random Forest\nRéel vs Prédit (R²={r2_rf*100:.1f}%)', fontweight='bold')
ax4.legend(fontsize=9)
ax4.set_facecolor('#f8fafc')
ax4.spines['top'].set_visible(False)
ax4.spines['right'].set_visible(False)

# ── 5. Réel vs Prédit — XGBoost ──
ax5 = fig.add_subplot(gs[1, 1])
ax5.scatter(y_test, pred_xgb, alpha=0.4, color=COLORS['xgb'], s=15)
ax5.plot(lim, lim, '--', color=COLORS['ideal'], linewidth=2, label='Parfait')
ax5.set_xlabel('Prix réel (TND)', fontweight='bold')
ax5.set_ylabel('Prix prédit (TND)', fontweight='bold')
ax5.set_title(f'XGBoost (Bayes)\nRéel vs Prédit (R²={r2_xgb*100:.1f}%)', fontweight='bold')
ax5.legend(fontsize=9)
ax5.set_facecolor('#f8fafc')
ax5.spines['top'].set_visible(False)
ax5.spines['right'].set_visible(False)

# ── 6. Distribution des erreurs ──
ax6 = fig.add_subplot(gs[1, 2])
erreurs_rf  = y_test.values - pred_rf
erreurs_xgb = y_test.values - pred_xgb
ax6.hist(erreurs_rf,  bins=40, alpha=0.6, color=COLORS['rf'],  label=f'RF  (MAE={mae_rf:.3f})')
ax6.hist(erreurs_xgb, bins=40, alpha=0.6, color=COLORS['xgb'], label=f'XGB (MAE={mae_xgb:.3f})')
ax6.axvline(0, color='black', linestyle='--', linewidth=1.5)
ax6.set_xlabel('Erreur (TND)', fontweight='bold')
ax6.set_ylabel('Fréquence', fontweight='bold')
ax6.set_title("Distribution des erreurs\nPlus centré sur 0 = meilleur", fontweight='bold')
ax6.legend(fontsize=9)
ax6.set_facecolor('#f8fafc')
ax6.spines['top'].set_visible(False)
ax6.spines['right'].set_visible(False)

plt.savefig(
    os.path.join(BASE_DIR, 'comparaison_modeles.png'),
    dpi=150, bbox_inches='tight', facecolor='white'
)
plt.show()
print("Graphique sauvegardé : comparaison_modeles.png")