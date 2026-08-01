import pandas as pd

df_proy = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name=0)
df_real = pd.read_excel('Preventivos Realizados 2026.xlsx', sheet_name=0)
df_taller = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name='Taller')

cc_col = df_taller.columns[0]
base_col = df_taller.columns[1]

taller_map = {}
for _, row in df_taller.iterrows():
    k = str(row[cc_col]).strip()
    v = str(row[base_col]).strip()
    if k and v and k.lower() != 'nan':
        taller_map[k] = v

def get_taller_proyectado(cc):
    if not cc:
        return 'Sin Taller Proyectado'
    cc_str = str(cc).strip()
    if cc_str in taller_map:
        return taller_map[cc_str]
    for k_map, v_map in taller_map.items():
        if cc_str.lower() == k_map.lower() or cc_str.lower() in k_map.lower() or k_map.lower() in cc_str.lower():
            return v_map
    return 'Sin Taller Proyectado'

all_proy_ccs = set(df_proy['CC'].dropna().astype(str).str.strip())
all_real_ccs = set(df_real.iloc[:, 3].dropna().astype(str).str.strip())
all_ccs = all_proy_ccs.union(all_real_ccs)

print("\n--- Resultado de Mapeo por CC ---")
taller_proy_unique = set()
for cc in sorted(list(all_ccs)):
    t_proy = get_taller_proyectado(cc)
    taller_proy_unique.add(t_proy)
    print(f"  CC: '{cc}' ==> Taller Proyectado: '{t_proy}'")

print("\nTalleres Proyectados Únicos:", sorted(list(taller_proy_unique)))
