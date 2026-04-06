# -*- coding: utf-8 -*-
dados_corrigidos = {
    'ESSENCE': {'fat_adm': 42731.25, 'fat_sub': 15118.57, 'cust_adm': 16165.64, 'cust_sub': 14290.70},
    'EASY': {'fat_adm': 15392.92, 'fat_sub': 0, 'cust_adm': 4376.95, 'cust_sub': 0},
    'CULLINAN': {'fat_adm': 5899.98, 'fat_sub': 33954.79, 'cust_adm': 2302.04, 'cust_sub': 35440.79},
    'ATHOS': {'fat_adm': 5303.85, 'fat_sub': 31727.99, 'cust_adm': 2418.50, 'cust_sub': 29558.77},
    'NOBILE': {'fat_adm': 2622.24, 'fat_sub': 4929.19, 'cust_adm': 1135.68, 'cust_sub': 7128.84},
    'FUSION': {'fat_adm': 10363.57, 'fat_sub': 5715.45, 'cust_adm': 5603.93, 'cust_sub': 8528.84},
    'MERCURE': {'fat_adm': 11972.48, 'fat_sub': 33459.78, 'cust_adm': 7276.39, 'cust_sub': 30543.15},
    'METROPOLITAN': {'fat_adm': 18663.53, 'fat_sub': 4889.42, 'cust_adm': 8834.73, 'cust_sub': 3174.81},
    'RAMADA': {'fat_adm': 4173.52, 'fat_sub': 0, 'cust_adm': 4698.76, 'cust_sub': 0},
    'BRISAS': {'fat_adm': 25925.84, 'fat_sub': 18728.61, 'cust_adm': 11015.57, 'cust_sub': 17935.67},
    'VISION': {'fat_adm': 0, 'fat_sub': 3315.12, 'cust_adm': 0, 'cust_sub': 2914.42},
}

def fmt(val):
    return f"R$ {val:>12,.2f}".replace(',', '|').replace('.', ',').replace('|', '.')

# Calcula análise por empreendimento
print("\n" + "="*110)
print("ANALISE FEVEREIRO - DADOS CORRIGIDOS")
print("="*110)

totais = {'fat_adm': 0, 'fat_sub': 0, 'cust_adm': 0, 'cust_sub': 0}
empreendimentos_calc = {}

print("\n%-20s %18s %18s %18s %18s %18s %12s" % ("Empreendimento", "Faturamento ADM", "Faturamento SUB", "Custos ADM", "Custos SUB", "Lucro Liquido", "Margem %"))
print("-"*110)

for nome in sorted(dados_corrigidos.keys()):
    dados = dados_corrigidos[nome]
    fat_total = dados['fat_adm'] + dados['fat_sub']
    cust_total = dados['cust_adm'] + dados['cust_sub']
    lucro = fat_total - cust_total
    margem = (lucro / fat_total * 100) if fat_total > 0 else 0
    
    empreendimentos_calc[nome] = {
        'fat_total': fat_total,
        'cust_total': cust_total,
        'lucro': lucro,
        'margem': margem
    }
    
    totais['fat_adm'] += dados['fat_adm']
    totais['fat_sub'] += dados['fat_sub']
    totais['cust_adm'] += dados['cust_adm']
    totais['cust_sub'] += dados['cust_sub']
    
    print("%-20s %18s %18s %18s %18s %18s %11.2f%%" % (
        nome,
        fmt(dados['fat_adm']),
        fmt(dados['fat_sub']),
        fmt(dados['cust_adm']),
        fmt(dados['cust_sub']),
        fmt(lucro),
        margem
    ))

print("-"*110)
fat_total = totais['fat_adm'] + totais['fat_sub']
cust_total = totais['cust_adm'] + totais['cust_sub']
lucro_total = fat_total - cust_total
margem_total = (lucro_total / fat_total * 100) if fat_total > 0 else 0

print("%-20s %18s %18s %18s %18s %18s %11.2f%%" % (
    "TOTAL",
    fmt(totais['fat_adm']),
    fmt(totais['fat_sub']),
    fmt(totais['cust_adm']),
    fmt(totais['cust_sub']),
    fmt(lucro_total),
    margem_total
))
print("="*110)

print("\n" + "="*110)
print("RESUMO CONSOLIDADO")
print("="*110)
print("Faturamento ADM    : %s" % fmt(totais['fat_adm']))
print("Faturamento SUB    : %s" % fmt(totais['fat_sub']))
print("Faturamento TOTAL  : %s" % fmt(fat_total))
print("-"*110)
print("Custos ADM         : %s" % fmt(totais['cust_adm']))
print("Custos SUB         : %s" % fmt(totais['cust_sub']))
print("Custos TOTAL       : %s" % fmt(cust_total))
print("-"*110)
print("Lucro Liquido      : %s" % fmt(lucro_total))
print("Margem Liquida     : %.2f%%" % margem_total)
print("="*110)

print("\n" + "="*110)
print("TOP 5 MELHORES EMPREENDIMENTOS (Por Lucro)")
print("="*110)
top_5 = sorted(empreendimentos_calc.items(), key=lambda x: x[1]['lucro'], reverse=True)[:5]
for i, (nome, dados) in enumerate(top_5, 1):
    print("%d. %-15s - Lucro: %s | Margem: %.2f%%" % (i, nome, fmt(dados['lucro']), dados['margem']))

print("\n" + "="*110)
print("TOP 5 PIORES EMPREENDIMENTOS (Por Lucro)")
print("="*110)
bottom_5 = sorted(empreendimentos_calc.items(), key=lambda x: x[1]['lucro'])[:5]
for i, (nome, dados) in enumerate(bottom_5, 1):
    print("%d. %-15s - Lucro: %s | Margem: %.2f%%" % (i, nome, fmt(dados['lucro']), dados['margem']))

print("\n")
