import pandas as pd
import re

df_proy = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name=0)
df_real = pd.read_excel('Preventivos Realizados 2026.xlsx', sheet_name=0)
df_taller = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name='Taller')

cc_col = df_taller.columns[0]
base_col = df_taller.columns[1]

raw_map = {}
for _, row in df_taller.iterrows():
    k = str(row[cc_col]).strip()
    v = str(row[base_col]).strip()
    if k and v and k.lower() != 'nan':
        raw_map[k] = v

def norm(s):
    if not s: return ""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

norm_map = {}
for k, v in raw_map.items():
    norm_map[norm(k)] = v

def get_taller_proyectado(cc_name):
    if not cc_name:
        return 'Sin Taller Proyectado'
    s = str(cc_name).strip()
    # 1. Exact match
    if s in raw_map:
        return raw_map[s]
    # 2. Normalized match
    n_s = norm(s)
    if n_s in norm_map:
        return norm_map[n_s]
    # 3. Substring match
    for k_norm, v_val in norm_map.items():
        if k_norm in n_s or n_s in k_norm:
            return v_val
    # 4. Special cases
    if 'arcor' in n_s: return 'Taller Buenos Aires'
    if 'cimsa' in n_s: return 'Taller Buenos Aires'
    if 'cenco' in n_s: return 'Taller Mendoza'
    return 'Sin Taller Proyectado'

all_ccs = set(df_proy['CC'].dropna().astype(str).str.strip()).union(set(df_real.iloc[:, 3].dropna().astype(str).str.strip()))

print("\n--- Mapeo final normalizado ---")
for cc in sorted(list(all_ccs)):
    tp = get_taller_proyectado(cc)
    print(f"CC: '{cc}' ===> Taller Proyectado: '{tp}'")

