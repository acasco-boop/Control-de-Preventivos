import pandas as pd

df_proy = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name=0)
df_taller = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name='Taller')

cc_map = {}
cc_col = df_taller.columns[0]
base_col = df_taller.columns[1]

for _, row in df_taller.iterrows():
    k = str(row[cc_col]).strip()
    v = str(row[base_col]).strip()
    if k and v and k.lower() != 'nan':
        cc_map[k] = v

unique_proy_ccs = df_proy['CC'].dropna().astype(str).str.strip().unique()

matched = 0
unmatched = []

for cc in unique_proy_ccs:
    if cc in cc_map:
        matched += 1
    else:
        found = False
        for k_map, v_map in cc_map.items():
            if cc.lower() == k_map.lower() or cc.lower() in k_map.lower() or k_map.lower() in cc.lower():
                found = True
                print(f"Match parcial: '{cc}' <-> '{k_map}' => {v_map}")
                break
        if not found:
            unmatched.append(cc)

print(f"\nTotal CCs en Proyeccion: {len(unique_proy_ccs)}")
print(f"Emparejados exactos: {matched}")
print(f"Sin emparejar: {unmatched}")
