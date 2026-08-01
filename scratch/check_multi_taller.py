import pandas as pd
from collections import defaultdict

df_taller = pd.read_excel('Preventivos Proyeccion 2026.xlsx', sheet_name='Taller')
print(df_taller.to_string())

cc_to_talleres = defaultdict(list)
cc_col = df_taller.columns[0]
base_col = df_taller.columns[1]

for _, r in df_taller.iterrows():
    cc = str(r[cc_col]).strip()
    taller = str(r[base_col]).strip()
    if cc and taller and cc.lower() != 'nan':
        if taller not in cc_to_talleres[cc]:
            cc_to_talleres[cc].append(taller)

print("\n--- CCs con múltiples talleres asignados en la hoja Taller ---")
for cc, t_list in cc_to_talleres.items():
    print(f"CC: '{cc}' => {t_list}")
