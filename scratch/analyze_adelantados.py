import pandas as pd

f_proy = 'Preventivos Proyeccion 2026.xlsx'
f_real = 'Preventivos Realizados 2026.xlsx'

xl_proy = pd.ExcelFile(f_proy)
df_proy = pd.read_excel(xl_proy, sheet_name=0)
df_real = pd.read_excel(f_real)

df_proy['Patente'] = df_proy.iloc[:, 0].astype(str).str.strip().str.upper()
df_proy['Plan'] = df_proy.iloc[:, 1].astype(str).str.strip()
df_proy['CC'] = df_proy.iloc[:, 2].astype(str).str.strip()
df_proy['Fecha_Est'] = pd.to_datetime(df_proy.iloc[:, 3], errors='coerce')

df_real['Patente'] = df_real.iloc[:, 0].astype(str).str.strip().str.upper()
df_real['Fecha_Real'] = pd.to_datetime(df_real.iloc[:, 1], errors='coerce')

print("=== INSPECCIÓN DE MATCHES EXECUCIÓN VS PROYECCIÓN ===")
count_far = 0

for pat in sorted(df_proy['Patente'].unique()):
    p_sub = df_proy[df_proy['Patente'] == pat].sort_values('Fecha_Est')
    r_sub = df_real[df_real['Patente'] == pat].sort_values('Fecha_Real')
    
    if len(p_sub) > 0 and len(r_sub) > 0:
        for _, p in p_sub.iterrows():
            p_date = p['Fecha_Est']
            for _, r in r_sub.iterrows():
                r_date = r['Fecha_Real']
                diff_days = (p_date - r_date).days
                if diff_days > 45:
                    count_far += 1
                    print(f"Patente: {pat:<8} | Realizado: {r_date.strftime('%d/%m/%Y')} (Mes {r_date.month}) | Proyectado Futuro: {p_date.strftime('%d/%m/%Y')} (Mes {p_date.month}) | Diferencia: {diff_days} días")

print(f"\nTotal de coincidencias donde la ejecución ocurrió más de 45 días antes de la proyección: {count_far}")
