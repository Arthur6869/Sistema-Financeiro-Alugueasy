import pandas as pd
import json

files = {
    "custos_adm": "_  COFERENCIA DE CUSTOS - ADM - JAN (1).xlsx",
    "custos_sub": "_ COFERENCIA DE CUSTOS - SUB - JAN.xlsx",
    "diarias_adm": "_  COFERENCIA DE DIARIAS - ADM - JAN.xlsx",
    "diarias_sub": "_ COFERENCIA DE DIARIAS - SUB - JAN.xlsx",
}

for tipo, fname in files.items():
    print(f"\n{'='*60}")
    print(f"ARQUIVO: {fname}")
    print(f"TIPO: {tipo}")
    print(f"{'='*60}")
    try:
        # raw sem header
        df_raw = pd.read_excel(fname, header=None)
        rows, cols = df_raw.shape
        print(f"Dimensoes: {rows} linhas x {cols} colunas")
        print(f"\nPrimeiras 6 linhas (raw):")
        print(df_raw.head(6).to_string())
        print(f"\nUltimas 3 linhas:")
        print(df_raw.tail(3).to_string())
        
        # Extrair numeros de apartamentos (linha 0, colunas pares)
        aptos = []
        for col_i in range(0, cols, 2):
            val = df_raw.iloc[0, col_i]
            if pd.notna(val) and str(val).replace('.', '').replace('0','').strip() != '':
                try:
                    apt_num = str(int(float(val)))
                    aptos.append((col_i, apt_num))
                except:
                    aptos.append((col_i, str(val)))
        print(f"\nApartamentos encontrados ({len(aptos)}): {[a[1] for a in aptos]}")
        
        if "custos" in tipo:
            print("\nAmostra de custos (primeiras 3 colunas de apto):")
            for col_i, apt in aptos[:3]:
                print(f"\n  Apt {apt}:")
                for row_i in range(1, min(rows, 8)):
                    val = df_raw.iloc[row_i, col_i]
                    cat = df_raw.iloc[row_i, col_i+1] if col_i+1 < cols else None
                    if pd.notna(val) and isinstance(val, (int, float)) and val > 0:
                        print(f"    row {row_i}: valor={val:.2f} | cat={cat}")
        else:
            print("\nAmostra de diarias (primeiras 3 colunas de apto):")
            for col_i, apt in aptos[:3]:
                print(f"\n  Apt {apt}:")
                for row_i in range(1, min(rows, 5)):
                    val = df_raw.iloc[row_i, col_i]
                    if pd.notna(val):
                        print(f"    row {row_i}: valor={val}")

    except Exception as e:
        print(f"ERRO: {e}")
