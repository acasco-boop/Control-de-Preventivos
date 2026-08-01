import pandas as pd
import json
import os
import re
from collections import defaultdict

def clean_cc_name(cc_raw):
    if pd.isna(cc_raw):
        return None
    val = str(cc_raw).strip()
    if not val or val.lower() in ['nan', 'null', 'none', '(en blanco)', 'en blanco', '0', '-']:
        return None
    return val

def norm(s):
    if not s: return ""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

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
    return abbrev_map.get(clean, str(t_name).strip().upper())

def test_refined_algorithm():
    proy_path = 'Preventivos Proyeccion 2026.xlsx'
    real_path = 'Preventivos Realizados 2026.xlsx'

    xl_proy = pd.ExcelFile(proy_path)
    df_proy = pd.read_excel(xl_proy, sheet_name=0)

    cc_to_talleres_raw = defaultdict(list)
    if 'Taller' in xl_proy.sheet_names:
        df_taller_sheet = pd.read_excel(xl_proy, sheet_name='Taller')
        cc_col = df_taller_sheet.columns[0]
        base_col = df_taller_sheet.columns[1]
        for _, r in df_taller_sheet.iterrows():
            k = clean_cc_name(r[cc_col])
            v = str(r[base_col]).strip()
            if k and v and k.lower() != 'nan':
                if v not in cc_to_talleres_raw[k]:
                    cc_to_talleres_raw[k].append(v)

    norm_taller_map = {}
    for k, t_list in cc_to_talleres_raw.items():
        abbrevs = [get_abbrev(t) for t in t_list]
        joined = " / ".join(abbrevs)
        norm_taller_map[norm(k)] = (joined, abbrevs)

    def get_taller_proyectado_info(cc_name):
        if not cc_name:
            return ('Sin Taller Proyectado', ['Sin Taller Proyectado'])
        s = str(cc_name).strip()
        n_s = norm(s)
        if n_s in norm_taller_map:
            return norm_taller_map[n_s]
        for k_norm, v_info in norm_taller_map.items():
            if k_norm in n_s or n_s in k_norm:
                return v_info
        if 'arcor' in n_s: return ('BSAS', ['BSAS'])
        if 'cimsa' in n_s: return ('BSAS', ['BSAS'])
        if 'cenco' in n_s: return ('MNZA', ['MNZA'])
        return ('Sin Taller Proyectado', ['Sin Taller Proyectado'])

    df_real = pd.read_excel(real_path)

    df_proy['Patente'] = df_proy.iloc[:, 0].astype(str).str.strip().str.upper()
    df_proy['Plan'] = df_proy.iloc[:, 1].astype(str).str.strip()
    df_proy['CC'] = df_proy.iloc[:, 2].apply(clean_cc_name)
    df_proy['Fecha_Est'] = pd.to_datetime(df_proy.iloc[:, 3], errors='coerce')
    df_proy['Mes_Orig'] = df_proy['Fecha_Est'].dt.month

    df_real['Patente'] = df_real.iloc[:, 0].astype(str).str.strip().str.upper()
    df_real['Plan'] = df_real.iloc[:, 2].astype(str).str.strip()
    df_real['CC'] = df_real.iloc[:, 3].apply(clean_cc_name)
    df_real['Fecha_Real'] = pd.to_datetime(df_real.iloc[:, 1], errors='coerce')
    df_real['Mes_Ejec'] = df_real['Fecha_Real'].dt.month
    df_real['Taller'] = df_real.iloc[:, 4].astype(str).str.strip().str.upper()

    vehicle_cc_map = {}
    for idx, row in df_proy.iterrows():
        pat = row['Patente']
        cc = row['CC']
        if pat and cc and pat not in vehicle_cc_map:
            vehicle_cc_map[pat] = cc

    for idx, row in df_real.iterrows():
        pat = row['Patente']
        cc = row['CC']
        if pat and cc and pat not in vehicle_cc_map:
            vehicle_cc_map[pat] = cc

    df_proy['CC'] = df_proy.apply(lambda r: r['CC'] if r['CC'] else vehicle_cc_map.get(r['Patente'], 'Sin Centro de Costo'), axis=1)
    df_real['CC'] = df_real.apply(lambda r: r['CC'] if r['CC'] else vehicle_cc_map.get(r['Patente'], 'Sin Centro de Costo'), axis=1)

    months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    results = []
    item_id = 1
    r_used = set()

    for pat, p_group in df_proy.groupby('Patente'):
        r_group = df_real[df_real['Patente'] == pat].sort_values('Fecha_Real')
        p_group_sorted = p_group.sort_values('Fecha_Est')

        for p_idx, p_row in p_group_sorted.iterrows():
            fecha_est = p_row['Fecha_Est']
            mes_orig = int(p_row['Mes_Orig']) if not pd.isna(p_row['Mes_Orig']) else 1
            cc = p_row['CC']
            plan = p_row['Plan']
            t_proy_joined, t_proy_list = get_taller_proyectado_info(cc)

            avail_r = r_group[~r_group.index.isin(r_used)]

            matched_r = None
            match_type = None

            if len(avail_r) > 0:
                # 1. Exact month match
                exact_m = avail_r[avail_r['Mes_Ejec'] == mes_orig]
                if len(exact_m) > 0:
                    matched_r_idx = exact_m.index[0]
                    matched_r = exact_m.loc[matched_r_idx]
                    match_type = 'EN_FECHA'
                else:
                    # 2. Executed in a later month (roll-over executed)
                    later_r = avail_r[avail_r['Mes_Ejec'] > mes_orig]
                    if len(later_r) > 0:
                        matched_r_idx = later_r.index[0]
                        matched_r = later_r.loc[matched_r_idx]
                        match_type = 'FUERA_DE_TERMINO'
                    else:
                        # 3. Executed earlier ONLY IF within 45 days before fecha_est
                        earlier_r = avail_r[avail_r['Mes_Ejec'] < mes_orig]
                        for r_candidate_idx, r_candidate in earlier_r.iterrows():
                            if not pd.isna(fecha_est) and not pd.isna(r_candidate['Fecha_Real']):
                                diff_days = (fecha_est - r_candidate['Fecha_Real']).days
                                if 0 <= diff_days <= 45:
                                    matched_r_idx = r_candidate_idx
                                    matched_r = r_candidate
                                    match_type = 'ADELANTADO'
                                    break

            if matched_r is not None:
                r_used.add(matched_r_idx)
                mes_ejec = int(matched_r['Mes_Ejec']) if not pd.isna(matched_r['Mes_Ejec']) else mes_orig
                f_real_str = matched_r['Fecha_Real'].strftime('%d/%m/%Y') if not pd.isna(matched_r['Fecha_Real']) else '-'
                
                obs = ''
                if match_type == 'EN_FECHA':
                    obs = 'Ejecutado a tiempo en ' + f_real_str
                elif match_type == 'FUERA_DE_TERMINO':
                    obs = 'Ejecutado en ' + months[mes_ejec-1] + ' (Origen: ' + months[mes_orig-1] + ')'
                else:
                    obs = 'Ejecutado por adelantado en ' + months[mes_ejec-1] + ' (Programado: ' + months[mes_orig-1] + ')'

                results.append({
                    'id': item_id,
                    'patente': pat,
                    'centro_costo': cc,
                    'taller_proyectado': t_proy_joined,
                    'talleres_proyectados_list': t_proy_list,
                    'plan': plan,
                    'fecha_estimada': fecha_est.strftime('%Y-%m-%d') if not pd.isna(fecha_est) else '2026-01-01',
                    'mes_original': mes_orig,
                    'fecha_ejecucion': matched_r['Fecha_Real'].strftime('%Y-%m-%d') if not pd.isna(matched_r['Fecha_Real']) else None,
                    'mes_ejecucion': mes_ejec,
                    'taller': matched_r['Taller'] if not pd.isna(matched_r['Taller']) and str(matched_r['Taller']).lower() != 'nan' else 'Sin Taller',
                    'estado': match_type,
                    'observaciones': obs
                })
                item_id += 1
            else:
                # No valid match within cycle window -> Remains PENDIENTE
                results.append({
                    'id': item_id,
                    'patente': pat,
                    'centro_costo': cc,
                    'taller_proyectado': t_proy_joined,
                    'talleres_proyectados_list': t_proy_list,
                    'plan': plan,
                    'fecha_estimada': fecha_est.strftime('%Y-%m-%d') if not pd.isna(fecha_est) else '2026-01-01',
                    'mes_original': mes_orig,
                    'fecha_ejecucion': None,
                    'mes_ejecucion': None,
                    'taller': None,
                    'estado': 'PENDIENTE',
                    'observaciones': 'Pendiente de ejecución desde ' + months[mes_orig-1]
                })
                item_id += 1

    # Unmatched executions (extra or past cycle executions without matching projection window)
    unmatched_real = df_real[~df_real.index.isin(r_used)]
    for r_idx, r_row in unmatched_real.iterrows():
        pat = r_row['Patente']
        cc = r_row['CC']
        plan = r_row['Plan'] if not pd.isna(r_row['Plan']) else 'Mantenimiento Preventivo'
        fecha_real = r_row['Fecha_Real']
        mes_ejec = int(r_row['Mes_Ejec']) if not pd.isna(r_row['Mes_Ejec']) else 1
        taller = r_row['Taller'] if not pd.isna(r_row['Taller']) and str(r_row['Taller']).lower() != 'nan' else 'Sin Taller'
        t_proy_joined, t_proy_list = get_taller_proyectado_info(cc)
        f_real_str = fecha_real.strftime('%d/%m/%Y') if not pd.isna(fecha_real) else '-'

        results.append({
            'id': item_id,
            'patente': pat,
            'centro_costo': cc,
            'taller_proyectado': t_proy_joined,
            'talleres_proyectados_list': t_proy_list,
            'plan': plan,
            'fecha_estimada': fecha_real.strftime('%Y-%m-%d') if not pd.isna(fecha_real) else '2026-01-01',
            'mes_original': mes_ejec,
            'fecha_ejecucion': fecha_real.strftime('%Y-%m-%d') if not pd.isna(fecha_real) else '2026-01-01',
            'mes_ejecucion': mes_ejec,
            'taller': taller,
            'estado': 'EN_FECHA',
            'observaciones': 'Ejecutado en ' + months[mes_ejec-1] + ' (' + f_real_str + ')'
        })
        item_id += 1

    # Inspect HKW894
    hkw_items = [r for r in results if r['patente'] == 'HKW894']
    print("=== RESULTADOS PARA HKW894 ===")
    for h in hkw_items:
        print(f"Patente: {h['patente']} | Estado: {h['estado']} | Mes Orig: {h['mes_original']} | Mes Ejec: {h['mes_ejecucion']} | Obs: {h['observaciones']}")

    from collections import Counter
    st_counts = Counter([r['estado'] for r in results])
    print("\n=== DISTRIBUCIÓN DE ESTADOS CON ALGORITMO REFINADO ===")
    for st, cnt in st_counts.items():
        print(f" - {st}: {cnt}")

test_refined_algorithm()
