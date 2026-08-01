import pandas as pd

f_proy = 'Preventivos Proyeccion 2026.xlsx'
f_real = 'Preventivos Realizados 2026.xlsx'

xl_proy = pd.ExcelFile(f_proy)
df_proy = pd.read_excel(xl_proy, sheet_name=0)
df_real = pd.read_excel(f_real)

print("=== HOJA PROYECCIÓN (Preventivos Proyeccion 2026.xlsx) ===")
arcor_proy = set()
ccu_proy = set()
for idx, r in df_proy.iterrows():
    cc = str(r.iloc[2]).strip()
    if 'arcor' in cc.lower():
        arcor_proy.add((idx+2, cc))
    if 'ccu' in cc.lower():
        ccu_proy.add((idx+2, cc))

print("Valores Arcor en Proyección:", set(x[1] for x in arcor_proy))
print("Valores CCU en Proyección:", set(x[1] for x in ccu_proy))

print("\n=== HOJA REALIZADOS (Preventivos Realizados 2026.xlsx) ===")
arcor_real = set()
ccu_real = set()
for idx, r in df_real.iterrows():
    cc = str(r.iloc[3]).strip()
    if 'arcor' in cc.lower():
        arcor_real.add((idx+2, cc))
    if 'ccu' in cc.lower():
        ccu_real.add((idx+2, cc))

print("Valores Arcor en Realizados:", set(x[1] for x in arcor_real))
print("Valores CCU en Realizados:", set(x[1] for x in ccu_real))

if 'Taller' in xl_proy.sheet_names:
    df_taller = pd.read_excel(xl_proy, sheet_name='Taller')
    print("\n=== HOJA TALLER (Preventivos Proyeccion 2026.xlsx -> Taller) ===")
    arcor_t = set()
    ccu_t = set()
    for idx, r in df_taller.iterrows():
        cc = str(r.iloc[0]).strip()
        if 'arcor' in cc.lower():
            arcor_t.add((idx+2, cc))
        if 'ccu' in cc.lower():
            ccu_t.add((idx+2, cc))
    print("Valores Arcor en Hoja Taller:", set(x[1] for x in arcor_t))
    print("Valores CCU en Hoja Taller:", set(x[1] for x in ccu_t))
