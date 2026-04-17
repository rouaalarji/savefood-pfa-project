# ============================================================
#  VISUALISATION — Lance ce fichier APRÈS entrainement_modeles.py
#  Les résultats sont chargés depuis les fichiers sauvegardés
#  Lancer : python visualiser_resultats.py
# ============================================================

import pandas as pd
import numpy as np
import pickle
import os
import matplotlib
matplotlib.use('Agg')  # ← Pas besoin d'écran, sauvegarde directement en PNG
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# 1. RECHARGER ET RÉENTRAÎNER POUR AVOIR LES PRÉDICTIONS
# ============================================================
df = pd.read_csv(os.path.join(BASE_DIR, 'dataset_complet.csv'), encoding='utf-8-sig')
le = LabelEncoder()
df['categorie_encoded'] = le.fit_transform(df['categorie'])

X = df[['categorie_encoded','prix_initial','jours_avant_expiration','stock']]
y = df['prix_optimal']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Entraînement en cours...")

t = time.time()
rf = RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)
temps_rf = time.time() - t
pred_rf  = rf.predict(X_test)
r2_rf    = r2_score(y_test, pred_rf)
mae_rf   = mean_absolute_error(y_test, pred_rf)
rmse_rf  = np.sqrt(mean_squared_error(y_test, pred_rf))

t = time.time()
xgb = XGBRegressor(n_estimators=200, learning_rate=0.05, max_depth=6, random_state=42, verbosity=0)
xgb.fit(X_train, y_train)
temps_xgb = time.time() - t
pred_xgb  = xgb.predict(X_test)
r2_xgb    = r2_score(y_test, pred_xgb)
mae_xgb   = mean_absolute_error(y_test, pred_xgb)
rmse_xgb  = np.sqrt(mean_squared_error(y_test, pred_xgb))

print(f" Random Forest → R²: {r2_rf*100:.2f}%  MAE: {mae_rf:.4f} TND")
print(f" XGBoost       → R²: {r2_xgb*100:.2f}%  MAE: {mae_xgb:.4f} TND")

# ============================================================
# 2. CRÉER LES 6 COURBES
# ============================================================
COLORS = {'rf': '#059669', 'xgb': '#2563eb', 'ideal': '#dc2626'}

fig = plt.figure(figsize=(18, 12))
fig.suptitle('Comparaison Random Forest vs XGBoost — Prédiction Prix Optimal',
             fontsize=15, fontweight='bold', y=0.98)
gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.45, wspace=0.35)

# ── Courbe 1 : R² en barres ──
ax1 = fig.add_subplot(gs[0, 0])
vals = [r2_rf*100, r2_xgb*100]
bars = ax1.bar(['Random\nForest', 'XGBoost'], vals,
               color=[COLORS['rf'], COLORS['xgb']], width=0.5, edgecolor='white')
for bar, val in zip(bars, vals):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
             f'{val:.2f}%', ha='center', fontweight='bold', fontsize=13)
ax1.set_ylim(0, 108)
ax1.set_ylabel('R² (%)', fontweight='bold')
ax1.set_title('① Précision R²\nPlus haut = meilleur ', fontweight='bold', fontsize=11)
ax1.set_facecolor('#f8fafc')
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
# Surligner le meilleur
best_idx = 0 if r2_rf > r2_xgb else 1
bars[best_idx].set_edgecolor('gold')
bars[best_idx].set_linewidth(3)

# ── Courbe 2 : MAE en barres ──
ax2 = fig.add_subplot(gs[0, 1])
vals2 = [mae_rf, mae_xgb]
bars2 = ax2.bar(['Random\nForest', 'XGBoost'], vals2,
                color=[COLORS['rf'], COLORS['xgb']], width=0.5, edgecolor='white')
for bar, val in zip(bars2, vals2):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.001,
             f'{val:.4f}\nTND', ha='center', fontweight='bold', fontsize=11)
ax2.set_ylabel('MAE (TND)', fontweight='bold')
ax2.set_title('② Erreur Moyenne MAE\nPlus bas = meilleur ', fontweight='bold', fontsize=11)
ax2.set_facecolor('#f8fafc')
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)
best_idx2 = 0 if mae_rf < mae_xgb else 1
bars2[best_idx2].set_edgecolor('gold')
bars2[best_idx2].set_linewidth(3)

# ── Courbe 3 : Temps ──
ax3 = fig.add_subplot(gs[0, 2])
vals3 = [temps_rf, temps_xgb]
bars3 = ax3.bar(['Random\nForest', 'XGBoost'], vals3,
                color=[COLORS['rf'], COLORS['xgb']], width=0.5, edgecolor='white')
for bar, val in zip(bars3, vals3):
    ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
             f'{val:.2f}s', ha='center', fontweight='bold', fontsize=13)
ax3.set_ylabel("Temps (secondes)", fontweight='bold')
ax3.set_title("③ Vitesse d'entraînement\nPlus bas = meilleur ✅", fontweight='bold', fontsize=11)
ax3.set_facecolor('#f8fafc')
ax3.spines['top'].set_visible(False)
ax3.spines['right'].set_visible(False)
best_idx3 = 0 if temps_rf < temps_xgb else 1
bars3[best_idx3].set_edgecolor('gold')
bars3[best_idx3].set_linewidth(3)

# ── Courbe 4 : Réel vs Prédit RF ──
ax4 = fig.add_subplot(gs[1, 0])
ax4.scatter(y_test, pred_rf, alpha=0.35, color=COLORS['rf'], s=12)
lim = [0, max(y_test.max(), pred_rf.max()) * 1.05]
ax4.plot(lim, lim, '--', color=COLORS['ideal'], linewidth=2, label='Ligne parfaite')
ax4.set_xlim(lim); ax4.set_ylim(lim)
ax4.set_xlabel('Prix réel (TND)', fontweight='bold')
ax4.set_ylabel('Prix prédit (TND)', fontweight='bold')
ax4.set_title(f'④ Random Forest — Réel vs Prédit\nR²={r2_rf*100:.1f}%', fontweight='bold', fontsize=11)
ax4.legend(fontsize=9)
ax4.set_facecolor('#f8fafc')
ax4.spines['top'].set_visible(False)
ax4.spines['right'].set_visible(False)

# ── Courbe 5 : Réel vs Prédit XGBoost ──
ax5 = fig.add_subplot(gs[1, 1])
ax5.scatter(y_test, pred_xgb, alpha=0.35, color=COLORS['xgb'], s=12)
ax5.plot(lim, lim, '--', color=COLORS['ideal'], linewidth=2, label='Ligne parfaite')
ax5.set_xlim(lim); ax5.set_ylim(lim)
ax5.set_xlabel('Prix réel (TND)', fontweight='bold')
ax5.set_ylabel('Prix prédit (TND)', fontweight='bold')
ax5.set_title(f'⑤ XGBoost — Réel vs Prédit\nR²={r2_xgb*100:.1f}%', fontweight='bold', fontsize=11)
ax5.legend(fontsize=9)
ax5.set_facecolor('#f8fafc')
ax5.spines['top'].set_visible(False)
ax5.spines['right'].set_visible(False)

# ── Courbe 6 : Distribution des erreurs ──
ax6 = fig.add_subplot(gs[1, 2])
erreurs_rf  = y_test.values - pred_rf
erreurs_xgb = y_test.values - pred_xgb
ax6.hist(erreurs_rf,  bins=40, alpha=0.6, color=COLORS['rf'],  label=f'RF  MAE={mae_rf:.3f}')
ax6.hist(erreurs_xgb, bins=40, alpha=0.6, color=COLORS['xgb'], label=f'XGB MAE={mae_xgb:.3f}')
ax6.axvline(0, color='black', linestyle='--', linewidth=2, label='Erreur = 0')
ax6.set_xlabel('Erreur de prédiction (TND)', fontweight='bold')
ax6.set_ylabel('Fréquence', fontweight='bold')
ax6.set_title('⑥ Distribution des erreurs\nPlus centré sur 0 = meilleur ✅', fontweight='bold', fontsize=11)
ax6.legend(fontsize=9)
ax6.set_facecolor('#f8fafc')
ax6.spines['top'].set_visible(False)
ax6.spines['right'].set_visible(False)

# ── Sauvegarder en PNG ──
output_img = os.path.join(BASE_DIR, 'comparaison_modeles.png')
plt.savefig(output_img, dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

print(f"\n✅ Image sauvegardée : comparaison_modeles.png")
print(f"📂 Ouvre ce fichier dans ton explorateur Windows pour voir les courbes")
print(f"   Chemin : {output_img}")

# Ouvrir automatiquement l'image dans Windows
import subprocess
try:
    subprocess.Popen(['start', output_img], shell=True)
    print("🖼️  Image ouverte automatiquement !")
except:
    pass