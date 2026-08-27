import pandas as pd
import json
import os
import re
from collections import defaultdict

# Dictionary to normalize CC name variations across different Excel files
CC_NORMALIZATION_MAP = {
    'arcor - arcor': 'Arcor S.A.I.C.',
    'arcor s.a.i.c.': 'Arcor S.A.I.C.',
    'arcor': 'Arcor S.A.I.C.',
    'ccucoaza - compañía industrial cer alianz': 'CCUCoAZA',
    'ccucoaza - compania industrial cer alianz': 'CCUCoAZA',
    'ccucoaza - compaia industrial cer alianz': 'CCUCoAZA',
    'ccucoaza': 'CCUCoAZA',
    'alfavini - alfavini': 'Alfavinil SA',
    'alfavinil sa': 'Alfavinil SA',
    'alfavinil': 'Alfavinil SA',
    'molca - molino cañuelas': 'Molca',
    'molca - molino canuelas': 'Molca',
    'molca': 'Molca',
    'topacio - topacio': 'Topacio',
    'topacio': 'Topacio',
    'cencomld - cencosud mza larga distancia': 'CENCOMLD - Cencosud SA - Mendoza',
    'cencomld - cencosud sa - mendoza': 'CENCOMLD - Cencosud SA - Mendoza'
}

def clean_cc_name(cc_raw):
    if pd.isna(cc_raw):
        return None
    val = str(cc_raw).strip()
    if not val or val.lower() in ['nan', 'null', 'none', '(en blanco)', 'en blanco', '0', '-']:
        return None
    val_lower = val.lower()
    if val_lower in CC_NORMALIZATION_MAP:
        return CC_NORMALIZATION_MAP[val_lower]
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

def parse_data():
    proy_path = 'Preventivos Proyeccion 2026.xlsx'
    real_path = 'Preventivos Realizados 2026.xlsx'

    xl_proy = pd.ExcelFile(proy_path)
    df_proy = pd.read_excel(xl_proy, sheet_name=0)

    # Read Taller mapping sheet and handle multiple talleres per CC
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

    # Clean & normalize projection
    df_proy['Patente'] = df_proy.iloc[:, 0].astype(str).str.strip().str.upper()
    df_proy['Plan'] = df_proy.iloc[:, 1].astype(str).str.strip()
    df_proy['CC'] = df_proy.iloc[:, 2].apply(clean_cc_name)
    df_proy['Fecha_Est'] = pd.to_datetime(df_proy.iloc[:, 3], errors='coerce')
    df_proy['Mes_Orig'] = df_proy['Fecha_Est'].dt.month

    # Clean & normalize real
    df_real['Patente'] = df_real.iloc[:, 0].astype(str).str.strip().str.upper()
    df_real['Plan'] = df_real.iloc[:, 2].astype(str).str.strip()
    df_real['CC'] = df_real.iloc[:, 3].apply(clean_cc_name)
    df_real['Fecha_Real'] = pd.to_datetime(df_real.iloc[:, 1], errors='coerce')
    df_real['Mes_Ejec'] = df_real['Fecha_Real'].dt.month
    df_real['Taller'] = df_real.iloc[:, 4].astype(str).str.strip().str.upper()

    # Build fallback dict for vehicle -> CC
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

    # Fill missing CCs
    df_proy['CC'] = df_proy.apply(lambda r: r['CC'] if r['CC'] else vehicle_cc_map.get(r['Patente'], 'Sin Centro de Costo'), axis=1)
    df_real['CC'] = df_real.apply(lambda r: r['CC'] if r['CC'] else vehicle_cc_map.get(r['Patente'], 'Sin Centro de Costo'), axis=1)

    # Unique Centros de Costo
    ccs = sorted(list(set(df_proy['CC'].dropna().unique()).union(set(df_real['CC'].dropna().unique()))))
    ccs = [c for c in ccs if c and c != 'Sin Centro de Costo']
    if 'Sin Centro de Costo' in set(df_proy['CC']).union(set(df_real['CC'])):
        ccs.append('Sin Centro de Costo')

    # Unique Talleres Realizados
    talleres_raw = df_real['Taller'].dropna().unique()
    talleres = sorted([t for t in talleres_raw if t and t.lower() != 'nan'])

    # Vehicles list
    vehicles_dict = {}
    for pat, cc in vehicle_cc_map.items():
        vehicles_dict[pat] = {'patente': pat, 'centro_costo': cc}

    vehicles = list(vehicles_dict.values())
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
                        # 3. Executed earlier ONLY IF within 45 days before fecha_est (true early execution window)
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
                    'observaciones': obs,
                    'tiene_orden_realizado': True
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
                    'observaciones': 'Pendiente de ejecución desde ' + months[mes_orig-1],
                    'tiene_orden_realizado': False
                })
                item_id += 1

    # Unmatched executions (past cycle executions or extra services)
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
            'observaciones': 'Ejecutado en ' + months[mes_ejec-1] + ' (' + f_real_str + ')',
            'tiene_orden_realizado': True
        })
        item_id += 1

    # Build unique talleres proyectados list
    t_proy_set = set()
    for r in results:
        t_proy_set.add(r['taller_proyectado'])
        for single_t in r['talleres_proyectados_list']:
            t_proy_set.add(single_t)

    talleres_proyectados = sorted(list(t_proy_set))

    output = {
        'centros_de_costo': ccs,
        'talleres': talleres,
        'talleres_proyectados': talleres_proyectados,
        'vehiculos': vehicles,
        'mantenimientos': results
    }

    os.makedirs('data', exist_ok=True)
    with open('data/maintenance_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Data parsed with tiene_orden_realizado field: {len(ccs)} CCs, {len(talleres)} Talleres Realizados, {len(results)} Mantenimientos.")


def parse_budget_data():
    budget_path = 'Proyeccion Segun Presupuesto 2026.xlsx'
    real_path = 'Preventivos Realizados 2026.xlsx'

    xl_budget = pd.ExcelFile(budget_path)
    df_budget = pd.read_excel(xl_budget, sheet_name=0)

    # Deduplicate: keep unique Patente + Plan + Fecha
    df_budget = df_budget.drop_duplicates(subset=['Patente', 'Plan Asociado', 'Fecha Plan Prox'], keep='first').reset_index(drop=True)

    # Clean & normalize budget
    df_budget['Patente'] = df_budget['Patente'].astype(str).str.strip().str.upper()
    df_budget['Plan'] = df_budget['Plan Asociado'].astype(str).str.strip()
    df_budget['CC'] = df_budget['CC'].apply(clean_cc_name)
    df_budget['Fecha_Est'] = pd.to_datetime(df_budget['Fecha Plan Prox'], errors='coerce')
    df_budget['Mes_Orig'] = df_budget['Fecha_Est'].dt.month
    df_budget['Taller_Corresp'] = df_budget['Taller Correspondiente'].astype(str).str.strip()
    df_budget.loc[df_budget['Taller_Corresp'].str.lower() == 'nan', 'Taller_Corresp'] = None

    # Read real executions
    df_real = pd.read_excel(real_path)
    df_real['Patente'] = df_real.iloc[:, 0].astype(str).str.strip().str.upper()
    df_real['Plan'] = df_real.iloc[:, 2].astype(str).str.strip()
    df_real['CC'] = df_real.iloc[:, 3].apply(clean_cc_name)
    df_real['Fecha_Real'] = pd.to_datetime(df_real.iloc[:, 1], errors='coerce')
    df_real['Mes_Ejec'] = df_real['Fecha_Real'].dt.month
    df_real['Taller'] = df_real.iloc[:, 4].astype(str).str.strip().str.upper()

    # Build fallback dict for vehicle -> CC
    vehicle_cc_map = {}
    for idx, row in df_budget.iterrows():
        pat = row['Patente']
        cc = row['CC']
        if pat and cc and pat not in vehicle_cc_map:
            vehicle_cc_map[pat] = cc
    for idx, row in df_real.iterrows():
        pat = row['Patente']
        cc = row['CC']
        if pat and cc and pat not in vehicle_cc_map:
            vehicle_cc_map[pat] = cc

    # Fill missing CCs
    df_budget['CC'] = df_budget.apply(lambda r: r['CC'] if r['CC'] else vehicle_cc_map.get(r['Patente'], 'Sin Centro de Costo'), axis=1)
    df_real['CC'] = df_real.apply(lambda r: r['CC'] if r['CC'] else vehicle_cc_map.get(r['Patente'], 'Sin Centro de Costo'), axis=1)

    # Read Taller mapping from the projection Excel (reuse same mapping)
    proy_path = 'Preventivos Proyeccion 2026.xlsx'
    xl_proy = pd.ExcelFile(proy_path)
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

    # Unique Centros de Costo
    ccs = sorted(list(set(df_budget['CC'].dropna().unique()).union(set(df_real['CC'].dropna().unique()))))
    ccs = [c for c in ccs if c and c != 'Sin Centro de Costo']
    if 'Sin Centro de Costo' in set(df_budget['CC']).union(set(df_real['CC'])):
        ccs.append('Sin Centro de Costo')

    # Unique Talleres Realizados
    talleres_raw = df_real['Taller'].dropna().unique()
    talleres = sorted([t for t in talleres_raw if t and t.lower() != 'nan'])

    # Vehicles list
    vehicles_dict = {}
    for pat, cc in vehicle_cc_map.items():
        vehicles_dict[pat] = {'patente': pat, 'centro_costo': cc}
    vehicles = list(vehicles_dict.values())

    months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    results = []
    item_id = 1
    r_used = set()

    for pat, p_group in df_budget.groupby('Patente'):
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
                exact_m = avail_r[avail_r['Mes_Ejec'] == mes_orig]
                if len(exact_m) > 0:
                    matched_r_idx = exact_m.index[0]
                    matched_r = exact_m.loc[matched_r_idx]
                    match_type = 'EN_FECHA'
                else:
                    later_r = avail_r[avail_r['Mes_Ejec'] > mes_orig]
                    if len(later_r) > 0:
                        matched_r_idx = later_r.index[0]
                        matched_r = later_r.loc[matched_r_idx]
                        match_type = 'FUERA_DE_TERMINO'
                    else:
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
                    'observaciones': obs,
                    'tiene_orden_realizado': True
                })
                item_id += 1
            else:
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
                    'observaciones': 'Pendiente de ejecución desde ' + months[mes_orig-1],
                    'tiene_orden_realizado': False
                })
                item_id += 1

    # Unmatched executions
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
            'observaciones': 'Ejecutado en ' + months[mes_ejec-1] + ' (' + f_real_str + ')',
            'tiene_orden_realizado': True
        })
        item_id += 1

    # Build unique talleres proyectados list
    t_proy_set = set()
    for r in results:
        t_proy_set.add(r['taller_proyectado'])
        for single_t in r['talleres_proyectados_list']:
            t_proy_set.add(single_t)

    talleres_proyectados = sorted(list(t_proy_set))

    output = {
        'centros_de_costo': ccs,
        'talleres': talleres,
        'talleres_proyectados': talleres_proyectados,
        'vehiculos': vehicles,
        'mantenimientos': results
    }

    os.makedirs('data', exist_ok=True)
    with open('data/budget_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Budget data parsed: {len(ccs)} CCs, {len(talleres)} Talleres, {len(results)} Mantenimientos.")


if __name__ == '__main__':
    parse_data()
    parse_budget_data()
