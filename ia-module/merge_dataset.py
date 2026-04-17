import pandas as pd

# 📌 Liste des fichiers CSV (tes 5 sites)
files = [
    "dataset_nettoye.csv",
    "data/otrity.csv",
    "data/dataset monoprix.csv"
]

# 📌 Lire et concaténer tous les fichiers
df_list = []

for file in files:
    df = pd.read_csv(file)
    df_list.append(df)

# Fusion
df_final = pd.concat(df_list, ignore_index=True)

# 📌 Nettoyage

# Supprimer les doublons
df_final = df_final.drop_duplicates()

# Supprimer lignes vides
df_final = df_final.dropna(how='all')

# (optionnel) remplir les champs vides pour ML
df_final["prix_optimal"] = df_final["prix_optimal"].fillna("")
df_final["stock"] = df_final["stock"].fillna("")
df_final["date_expiration"] = df_final["date_expiration"].fillna("")
df_final["jours_avant_expiration"] = df_final["jours_avant_expiration"].fillna("")

# 📌 Sauvegarde
df_final.to_csv("dataset_final.csv", index=False, encoding='utf-8-sig')

print("✅ Dataset fusionné et nettoyé avec succès !")