import pandas as pd
from collections import defaultdict
import re

df_proy = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name=0)
df_real = pd.read_excel('Preventivos Realizados 2026.xlsx', sheet_name=0)
df_taller = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name='Taller')

cc_col = df_taller.columns[0]
base_col = df_taller.columns[1]

cc_to_talleres_raw = defaultdict(list)
for _, r in df_taller.iterrows():
    k = str(r[cc_col]).strip()
    v = str(r[base_col]).strip()
    if k and v and k.lower() != 'nan':
        if v not in cc_to_talleres_raw[k]:
            cc_to_talleres_raw[k].append(v)

abbrev_map = {
    'taller buenos aires': 'BSAS',
    'taller mendoza': 'MNZA',
    'taller san rafael': 'SRAF',
    'taller ciudad': 'CIUD',
    'bsas': 'BSAS',
    'mnza': 'MNZA',
    'sraf': 'SRAF',
    'ciud': 'CIUD'
}

def get_abbrev(t_name):
    clean = str(t_name).strip().lower()
    return abbrev_map.get(clean, str(t_name).strip())

def norm(s):
    if not s: return ""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

norm_map = {}
for k, t_list in cc_to_talleres_raw.items():
    abbrevs = [get_abbrev(t) for t in t_list]
    joined = " / ".join(abbrevs)
    norm_map[norm(k)] = (joined, abbrevs)

def get_taller_proyectado_info(cc_name):
    if not cc_name:
        return ('Sin Taller Proyectado', ['Sin Taller Proyectado'])
    s = str(cc_name).strip()
    n_s = norm(s)
    
    if n_s in norm_map:
        return norm_map[n_s]
    
    for k_norm, v_info in norm_map.items():
        if k_norm in n_s or n_s in k_norm:
            return v_info
            
    if 'arcor' in n_s: return ('BSAS', ['BSAS'])
    if 'cimsa' in n_s: return ('BSAS', ['BSAS'])
    if 'cenco' in n_s: return ('MNZA', ['MNZA'])
    
    return ('Sin Taller Proyectado', ['Sin Taller Proyectado'])

all_ccs = set(df_proy['CC'].dropna().astype(str).str.strip()).union(set(df_real.iloc[:, 3].dropna().astype(str).str.strip()))

print("\n--- Mapeo de CC a Taller Proyectado Abrebiado ---")
for cc in sorted(list(all_ccs)):
    joined, abbrevs = get_taller_proyectado_info(cc)
    print(f"CC: '{cc}' ===> Taller Proyectado: '{joined}'")

