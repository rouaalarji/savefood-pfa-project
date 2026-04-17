# ============================================================
#  CORRECTION UNIQUEMENT : Produits Laitiers 18% → 35% normal
#  Lit et met à jour : dataset_complet.csv
#  Lancer : python fix_laitiers.py
# ============================================================

import pandas as pd
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
np.random.seed(42)

# ── Charger ──
df = pd.read_csv(os.path.join(BASE_DIR, 'dataset_complet.csv'), encoding='utf-8-sig')
print(f"Dataset chargé : {len(df)} lignes")

mask_laitiers = df['categorie'] == 'Produits Laitiers'
df_laitiers   = df[mask_laitiers].copy()

n             = len(df_laitiers)
actuels_normal = (df_laitiers['prix_optimal'] == df_laitiers['prix_initial']).sum()
cible_normal   = int(n * 0.35)
a_corriger     = max(0, cible_normal - actuels_normal)

print(f"\nProduits Laitiers : {n} produits")
print(f"  Normal actuel   : {actuels_normal} ({actuels_normal/n*100:.0f}%)")
print(f"  Cible           : {cible_normal} (35%)")
print(f"  À corriger      : {a_corriger} produits")

if a_corriger > 0:
    # Prendre les produits réduits avec le plus de jours restants (> 12j)
    idx_candidats = df_laitiers[
        (df_laitiers['prix_optimal'] < df_laitiers['prix_initial']) &
        (df_laitiers['jours_avant_expiration'] > 12)
    ].index

    # Si pas assez, élargir à > 10j
    if len(idx_candidats) < a_corriger:
        idx_candidats = df_laitiers[
            (df_laitiers['prix_optimal'] < df_laitiers['prix_initial']) &
            (df_laitiers['jours_avant_expiration'] >= 10)
        ].index

    n_fix = min(a_corriger, len(idx_candidats))
    idx_fix = np.random.choice(idx_candidats, size=n_fix, replace=False)
    df.loc[idx_fix, 'prix_optimal'] = df.loc[idx_fix, 'prix_initial']
    print(f"  ✅ {n_fix} produits corrigés → prix_optimal = prix_initial")

# ── Vérification ──
sub = df[df['categorie'] == 'Produits Laitiers']
normal = (sub['prix_optimal'] == sub['prix_initial']).sum()
reduit = len(sub) - normal
print(f"\nRésultat final Produits Laitiers :")
print(f"  Normal : {normal} ({normal/len(sub)*100:.0f}%)")
print(f"  Réduit : {reduit} ({reduit/len(sub)*100:.0f}%)")

# ── Sauvegarder ──
df.to_csv(os.path.join(BASE_DIR, 'dataset_complet.csv'), index=False, encoding='utf-8-sig')
print(f"\n✅ dataset_complet.csv mis à jour — prêt pour l'entraînement !")