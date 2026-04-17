# ============================================================
#  AJOUTER COLONNES — VERSION FINALE
#  - 80% produits réduits / 20% prix normal
#  - Formule continue : jours diminuent → prix diminue
#  - Durées corrigées : Épicerie=90j, Surgelés=90j
# ============================================================

import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TODAY    = datetime.today()
np.random.seed(42)

# ============================================================
# DURÉES DE VIE PAR CATÉGORIE (jours)
# ============================================================
DUREE_MAX = {
    'Produits Laitiers'   : 14,
    'Fruits et Légumes'   : 7,
    'Boulangerie'         : 4,
    'Viandes et Poissons' : 14,
    'Épicerie'            : 90,   # 3 mois
    'Surgelés'            : 60,   # 3 mois
}

# ============================================================
# SEUIL DE FRAÎCHEUR
# jours > seuil → prix normal (produit frais)
# jours ≤ seuil → réduction progressive
# Objectif : ~20% normal / ~80% réduit
# ============================================================
SEUIL_FRAIS = {
    'Produits Laitiers'   : 12,
    'Fruits et Légumes'   :  5,
    'Boulangerie'         :  3,
    'Viandes et Poissons' : 11,
    'Épicerie'            : 54,
    'Surgelés'            : 30,
}

# ============================================================
# COURBE DE RÉDUCTION
# coeff_min : prix minimum quand jours = 1  (ex: 0.30 = -70%)
# k=2       : courbe quadratique (réduction accélère vers expiration)
# ============================================================
COURBE = {
    #                         coeff_min   k
    'Produits Laitiers'   : ( 0.30,       2 ),   # -70% max
    'Fruits et Légumes'   : ( 0.20,       2 ),   # -80% max
    'Boulangerie'         : ( 0.20,       2 ),   # -80% max
    'Viandes et Poissons' : ( 0.30,       2 ),   # -70% max
    'Épicerie'            : ( 0.50,       1 ),   # -50% max
    'Surgelés'            : ( 0.55,       1 ),   # -45% max
}
COURBE_DEFAULT = (0.40, 2)

# ============================================================
# STOCK PAR CATÉGORIE
# ============================================================
STOCK_RANGE = {
    'Produits Laitiers'   : (15, 120),
    'Fruits et Légumes'   : (30, 250),
    'Boulangerie'         : (10, 80),
    'Viandes et Poissons' : (5,  40),
    'Épicerie'            : (40, 350),
    'Surgelés'            : (20, 180),
}

SUPERMARCHÉS = ['Carrefour', 'Monoprix', 'Géant', 'Aziza', 'MG']
ZONES_TN     = ['Tunis', 'Sousse', 'Sfax', 'Ariana', 'Ben Arous',
                 'Nabeul', 'Bizerte', 'Monastir', 'Gabès', 'Gafsa']


# ============================================================
# FORMULE DE CALCUL DU PRIX OPTIMAL
# ============================================================
def get_prix_optimal(prix_initial: float, jours: int,
                     duree_max: int, categorie: str) -> float:
    seuil              = SEUIL_FRAIS.get(categorie, 3)
    coeff_min, k       = COURBE.get(categorie, COURBE_DEFAULT)

    # Produit FRAIS → prix normal
    if jours > seuil:
        return round(float(prix_initial), 3)

    # Produit VIEILLISSANT → formule continue décroissante
    # ratio_norm = jours / seuil  → de 0 (expire demain) à 1 (au seuil)
    ratio_norm = jours / max(seuil, 1)
    coeff      = coeff_min + (1.0 - coeff_min) * (ratio_norm ** k)
    return round(prix_initial * coeff, 3)


# ============================================================
# AFFICHER LA COURBE AVANT GÉNÉRATION
# ============================================================
print("="*70)
print("COURBE DES PRIX PAR CATÉGORIE (prix_initial = 10 TND)")
print("="*70)
for cat in DUREE_MAX:
    duree = DUREE_MAX[cat]
    seuil = SEUIL_FRAIS[cat]
    cmin, k = COURBE.get(cat, COURBE_DEFAULT)
    print(f"\n{cat} (duree={duree}j | frais si jours > {seuil}j)")
    print(f"  {'Jours':>6} | {'Statut':>10} | {'Prix':>7} | {'Réduction':>10}")
    print(f"  {'─'*42}")
    for j in range(duree, 0, -max(1, duree//10)):
        prix  = get_prix_optimal(10.0, j, duree, cat)
        reduc = (1 - prix/10.0) * 100
        statut = 'FRAIS' if j > seuil else 'réduit'
        print(f"  {j:>6}j | {statut:>10} | {prix:>7.3f} | -{reduc:>7.1f}%")
    # Toujours afficher jour 1
    prix  = get_prix_optimal(10.0, 1, duree, cat)
    reduc = (1 - prix/10.0) * 100
    print(f"  {'1':>6}j | {'réduit':>10} | {prix:>7.3f} | -{reduc:>7.1f}%")


# ============================================================
# CHARGER dataset_clean.csv
# ============================================================
input_file = os.path.join(BASE_DIR, 'dataset_clean.csv')
df = pd.read_csv(input_file, encoding='utf-8-sig')
print(f"\n\n✅ Dataset chargé : {len(df)} lignes")

# ============================================================
# REMPLIR CHAQUE LIGNE
# ============================================================
jours_list    = []
dates_list    = []
stocks_list   = []
prix_opt_list = []

for i, (_, row) in enumerate(df.iterrows()):
    cat       = str(row.get('categorie', 'Épicerie')).strip()
    prix_init = float(row['prix_initial'])
    duree_max = DUREE_MAX.get(cat, 14)
    s_min, s_max = STOCK_RANGE.get(cat, (10, 100))

    # Supermarché
    sup_val = str(row.get('supermarche', '')).strip()
    if sup_val in ('', 'nan'):
        df.iloc[i, df.columns.get_loc('supermarche')] = np.random.choice(SUPERMARCHÉS)

    # Zone
    zone_val = str(row.get('zone', '')).strip()
    if zone_val in ('', 'nan'):
        df.iloc[i, df.columns.get_loc('zone')] = np.random.choice(ZONES_TN)

    # Stock
    try:
        stock_val = int(float(str(row.get('stock', 0)).strip()))
    except:
        stock_val = 0
    if stock_val == 0:
        stock_val = int(np.random.randint(s_min, s_max + 1))
    stocks_list.append(stock_val)

    # Jours — TOUJOURS régénérer entre 1 et duree_max
    jours = int(np.random.randint(1, duree_max + 1))
    jours_list.append(jours)

    # Date
    dates_list.append((TODAY + timedelta(days=jours)).strftime('%Y-%m-%d'))

    # Prix optimal
    prix_opt_list.append(get_prix_optimal(prix_init, jours, duree_max, cat))

# ============================================================
# APPLIQUER AU DATAFRAME
# ============================================================
df['jours_avant_expiration'] = jours_list
df['date_expiration']        = dates_list
df['stock']                  = stocks_list
df['prix_optimal']           = prix_opt_list

df['stock']                  = df['stock'].astype(int)
df['jours_avant_expiration'] = df['jours_avant_expiration'].astype(int)
df['prix_initial']           = df['prix_initial'].astype(float).round(3)
df['prix_optimal']           = df['prix_optimal'].astype(float).round(3)

# ============================================================
# VÉRIFICATION FINALE
# ============================================================
df['reduction_pct'] = ((df['prix_initial'] - df['prix_optimal'])
                       / df['prix_initial'] * 100).round(1)
df['a_reduction']   = df['reduction_pct'] > 0

print("\n" + "="*65)
print("RÉSUMÉ PAR CATÉGORIE")
print("="*65)
for cat in df['categorie'].unique():
    sub    = df[df['categorie'] == cat]
    normal = (~sub['a_reduction']).sum()
    reduit = sub['a_reduction'].sum()
    red    = sub[sub['a_reduction']]['reduction_pct']
    seuil  = SEUIL_FRAIS.get(cat, 3)
    duree  = DUREE_MAX.get(cat, 14)
    print(f"\n📦 {cat} — {len(sub)} produits  (durée={duree}j | frais si >{seuil}j)")
    print(f"   Prix NORMAL : {normal:>4} ({normal/len(sub)*100:.0f}%)")
    print(f"   Prix RÉDUIT : {reduit:>4} ({reduit/len(sub)*100:.0f}%)")
    if reduit > 0:
        print(f"   Réduction   : moy={red.mean():.1f}% | "
              f"min={red.min():.1f}% | max={red.max():.1f}%")
    print(f"   Jours moy   : {sub['jours_avant_expiration'].mean():.1f}j")

total    = len(df)
normal_g = (~df['a_reduction']).sum()
reduit_g = df['a_reduction'].sum()
print(f"\n{'='*65}")
print(f"TOTAL   : {total} produits")
print(f"NORMAL  : {normal_g} ({normal_g/total*100:.0f}%) ← cible ~20%")
print(f"RÉDUIT  : {reduit_g} ({reduit_g/total*100:.0f}%) ← cible ~80%")

if 15 <= normal_g/total*100 <= 25:
    print("✅ Distribution 80/20 correcte !")
else:
    print("⚠️  Distribution hors cible — ajuster les seuils si nécessaire")

# Aperçu Produits Laitiers
print("\n--- Aperçu Produits Laitiers (triés par jours) ---")
cols = ['prix_initial', 'jours_avant_expiration', 'prix_optimal', 'reduction_pct']
apercu = (df[df['categorie'] == 'Produits Laitiers'][cols]
          .sample(14).sort_values('jours_avant_expiration'))
print(apercu.to_string(index=False))

df = df.drop(columns=['reduction_pct', 'a_reduction'])

# ============================================================
# SAUVEGARDER
# ============================================================
output = os.path.join(BASE_DIR, 'dataset_complet.csv')
df.to_csv(output, index=False, encoding='utf-8-sig')
print(f"\n✅ dataset_complet.csv sauvegardé !")
print("\nProchaine étape :")
print("  1. Supprimer price_model.pkl  label_encoder.pkl  metrics.pkl")
print("  2. python Entrainement_modeles.py")