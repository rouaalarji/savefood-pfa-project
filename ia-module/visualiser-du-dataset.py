import pandas as pd

# Charger le dataset
df = pd.read_csv('dataset_clean.csv', encoding='utf-8-sig')

# Nombre de catégories
print("Nombre de catégories :", df['categorie'].nunique())

# Calcul nombre + pourcentage
counts = df['categorie'].value_counts()
percent = df['categorie'].value_counts(normalize=True) * 100

# Tableau final
result = pd.DataFrame({
    'Nombre': counts,
    'Pourcentage (%)': percent.round(2)
})

print("\nDistribution des catégories :")
print(result)