# ============================================================
#  VÉRIFICATION DATASET AVANT ENTRAÎNEMENT
#  Lancer : python check_dataset.py
# ============================================================

import pandas as pd
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

df = pd.read_csv(os.path.join(BASE_DIR, 'dataset_complet.csv'), encoding='utf-8-sig')

print("="*60)
print("VÉRIFICATION DATASET")
print("="*60)
print(f"Total lignes     : {len(df)}")
print(f"Total colonnes   : {len(df.columns)}")
print(f"Colonnes         : {list(df.columns)}")

# ── Valeurs manquantes ──
print("\n--- Valeurs manquantes ---")
nulls = df.isnull().sum()
if nulls.sum() == 0:
    print("✅ Aucune valeur manquante !")
else:
    print(nulls[nulls > 0])

# ── Stock = 0 ──
stock_zero = (df['stock'] == 0).sum()
print(f"\nStock = 0 : {stock_zero} lignes", "✅" if stock_zero == 0 else "⚠️ À corriger")

# ── Prix optimal vide ou égal à prix_initial ──
prix_egaux = (df['prix_optimal'] == df['prix_initial']).sum()
prix_reduit = (df['prix_optimal'] < df['prix_initial']).sum()
print(f"\nPrix optimal = prix_initial (sans réduction) : {prix_egaux} ({prix_egaux/len(df)*100:.0f}%)")
print(f"Prix optimal < prix_initial (avec réduction) : {prix_reduit} ({prix_reduit/len(df)*100:.0f}%)")

if prix_egaux/len(df) < 0.20:
    print("⚠️  Moins de 20% sans réduction → modèle peut être biaisé")
elif prix_egaux/len(df) > 0.80:
    print("⚠️  Plus de 80% sans réduction → pas assez d'exemples de réduction")
else:
    print("✅ Bonne distribution normal/réduit")

# ── Distribution par catégorie ──
print("\n--- Distribution par catégorie ---")
for cat in df['categorie'].unique():
    sub = df[df['categorie'] == cat]
    reduit = (sub['prix_optimal'] < sub['prix_initial']).sum()
    normal = len(sub) - reduit
    print(f"  {cat:<25} : {len(sub):>5} produits | "
          f"normal={normal} ({normal/len(sub)*100:.0f}%) | "
          f"réduit={reduit} ({reduit/len(sub)*100:.0f}%)")

# ── Jours avant expiration ──
print("\n--- Jours avant expiration ---")
print(df.groupby('categorie')['jours_avant_expiration'].agg(['min','max','mean']).round(1).to_string())

# ── Prix ──
print("\n--- Prix initial ---")
print(df['prix_initial'].describe().round(3).to_string())
print("\n--- Prix optimal ---")
print(df['prix_optimal'].describe().round(3).to_string())

# ── Taille suffisante pour XGBoost ? ──
print("\n--- Taille dataset ---")
min_recommande = 500
if len(df) < min_recommande:
    print(f"⚠️  Seulement {len(df)} lignes — XGBoost recommande au moins {min_recommande}")
elif len(df) < 1000:
    print(f"⚠️  {len(df)} lignes — correct mais plus de données = meilleur modèle")
else:
    print(f"✅ {len(df)} lignes — bonne taille pour XGBoost")

print("\n" + "="*60)
print("CONCLUSION")
print("="*60)

problemes = []
if nulls.sum() > 0:
    problemes.append("Valeurs manquantes détectées")
if stock_zero > 0:
    problemes.append(f"{stock_zero} lignes avec stock=0")
if len(df) < 500:
    problemes.append("Dataset trop petit")
if prix_egaux/len(df) < 0.20 or prix_egaux/len(df) > 0.80:
    problemes.append("Distribution normal/réduit déséquilibrée")

if not problemes:
    print("✅ Dataset prêt — tu peux lancer l'entraînement !")
else:
    print("⚠️  Problèmes à corriger avant entraînement :")
    for p in problemes:
        print(f"   - {p}")