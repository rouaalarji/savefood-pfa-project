import pandas as pd

# -----------------------------
# 1. LIRE ET FILTRER LES BONNES LIGNES
# -----------------------------

good_lines = []

with open("dataset_final.csv", "r", encoding="utf-8") as f:
    for line in f:
        if line.count(",") == 9:  # 10 colonnes = 9 virgules
            good_lines.append(line)

print(f"Lignes valides : {len(good_lines)}")

# Sauvegarder temporaire
with open("dataset_fixed.csv", "w", encoding="utf-8") as f:
    f.writelines(good_lines)

# -----------------------------
# 2. CHARGER DATASET PROPRE
# -----------------------------

df = pd.read_csv("dataset_fixed.csv")

# -----------------------------
# 3. SUPPRIMER DOUBLONS
# -----------------------------

df = df.drop_duplicates()
df = df.drop_duplicates(subset=["nom", "categorie", "prix_initial"])

print("Doublons supprimés")

# -----------------------------
# 4. LIMITER PRODUITS LAITIERS
# -----------------------------

df_laitiers = df[df["categorie"] == "Produits Laitiers"]
df_autres = df[df["categorie"] != "Produits Laitiers"]

# garder max 600
df_laitiers = df_laitiers.head(600)

# fusion
df = pd.concat([df_laitiers, df_autres])

print("Produits laitiers limités à 600")

# -----------------------------
# 5. ANALYSE
# -----------------------------

count_by_category = df["categorie"].value_counts()

print("\n📊 Nombre de produits par catégorie :")
print(count_by_category)

# -----------------------------
# 6. SAUVEGARDE FINAL
# -----------------------------

df.to_csv("dataset_clean.csv", index=False, encoding="utf-8-sig")

print("\n✅ Dataset clean prêt !")