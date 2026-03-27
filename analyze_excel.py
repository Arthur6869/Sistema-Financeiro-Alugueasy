import pandas as pd
import os

files = [
    "_  COFERENCIA DE CUSTOS - ADM - JAN (1).xlsx",
    "_  COFERENCIA DE DIARIAS - ADM - JAN.xlsx",
    "_ COFERENCIA DE CUSTOS - SUB - JAN.xlsx",
    "_ COFERENCIA DE DIARIAS - SUB - JAN.xlsx"
]

for f in files:
    print(f"\n--- Analisando: {f} ---")
    if os.path.exists(f):
        try:
            df = pd.read_excel(f, nrows=5)
            print("Colunas:", df.columns.tolist())
            print("Exemplo de dados:")
            print(df.head(2).to_string())
        except Exception as e:
            print(f"Erro ao ler {f}: {e}")
    else:
        print(f"Arquivo não encontrado: {f}")
