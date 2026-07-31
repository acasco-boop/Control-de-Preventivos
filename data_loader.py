import pandas as pd
import json
import os

def clean_cc_name(cc_raw):
    if pd.isna(cc_raw):
        return None
    val = str(cc_raw).strip()
    if not val or val.lower() in ['nan', 'null', 'none', '(en blanco)', 'en blanco', '0', '-']:
        return None
    return val

def parse_data():
    proy_path = 'Preventivos Proyeccion 2026.xlsx'
    real_path = 'Preventivos Realizados 2026.xlsx'

    df_proy = pd.read_excel(proy_path)
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

    # Unique Talleres
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

    # Match by patente with rollover absorption and explicit ADELANTADO classification
    for pat, p_group in df_proy.groupby('Patente'):
        r_group = df_real[df_real['Patente'] == pat].sort_values('Fecha_Real')
        p_group_sorted = p_group.sort_values('Fecha_Est')

        for p_idx, p_row in p_group_sorted.iterrows():
            fecha_est = p_row['Fecha_Est']
            mes_orig = int(p_row['Mes_Orig']) if not pd.isna(p_row['Mes_Orig']) else 1
            cc = p_row['CC']
            plan = p_row['Plan']

            avail_r = r_group[~r_group.index.isin(r_used)]

            if len(avail_r) > 0:
                # 1. Exact month match
                exact_m = avail_r[avail_r['Mes_Ejec'] == mes_orig]
                if len(exact_m) > 0:
                    r_match_idx = exact_m.index[0]
                    r_match = exact_m.loc[r_match_idx]
                    r_used.add(r_match_idx)
                    results.append({
                        'id': item_id,
                        'patente': pat,
                        'centro_costo': cc,
                        'plan': plan,
                        'fecha_estimada': fecha_est.strftime('%Y-%m-%d') if not pd.isna(fecha_est) else '2026-01-01',
                        'mes_original': mes_orig,
                        'fecha_ejecucion': r_match['Fecha_Real'].strftime('%Y-%m-%d'),
                        'mes_ejecucion': int(r_match['Mes_Ejec']),
                        'taller': r_match['Taller'] if not pd.isna(r_match['Taller']) and str(r_match['Taller']).lower() != 'nan' else 'Sin Taller',
                        'estado': 'EN_FECHA',
                        'observaciones': 'Ejecutado a tiempo en ' + r_match['Fecha_Real'].strftime('%d/%m/%Y')
                    })
                    item_id += 1
                else:
                    # 2. Executed in a later month (roll-over executed)
                    later_r = avail_r[avail_r['Mes_Ejec'] > mes_orig]
                    if len(later_r) > 0:
                        r_match_idx = later_r.index[0]
                        r_match = later_r.loc[r_match_idx]
                        r_used.add(r_match_idx)
                        mes_ejec = int(r_match['Mes_Ejec'])
                        results.append({
                            'id': item_id,
                            'patente': pat,
                            'centro_costo': cc,
                            'plan': plan,
                            'fecha_estimada': fecha_est.strftime('%Y-%m-%d') if not pd.isna(fecha_est) else '2026-01-01',
                            'mes_original': mes_orig,
                            'fecha_ejecucion': r_match['Fecha_Real'].strftime('%Y-%m-%d'),
                            'mes_ejecucion': mes_ejec,
                            'taller': r_match['Taller'] if not pd.isna(r_match['Taller']) and str(r_match['Taller']).lower() != 'nan' else 'Sin Taller',
                            'estado': 'FUERA_DE_TERMINO',
                            'observaciones': 'Ejecutado en ' + months[mes_ejec-1] + ' (Origen: ' + months[mes_orig-1] + ')'
                        })
                        item_id += 1
                    else:
                        # 3. Executed earlier / ahead of time (ADELANTADO)
                        earlier_r = avail_r[avail_r['Mes_Ejec'] < mes_orig]
                        if len(earlier_r) > 0:
                            r_match_idx = earlier_r.index[0]
                            r_match = earlier_r.loc[r_match_idx]
                            r_used.add(r_match_idx)
                            mes_ejec = int(r_match['Mes_Ejec'])
                            results.append({
                                'id': item_id,
                                'patente': pat,
                                'centro_costo': cc,
                                'plan': plan,
                                'fecha_estimada': fecha_est.strftime('%Y-%m-%d') if not pd.isna(fecha_est) else '2026-01-01',
                                'mes_original': mes_orig,
                                'fecha_ejecucion': r_match['Fecha_Real'].strftime('%Y-%m-%d'),
                                'mes_ejecucion': mes_ejec,
                                'taller': r_match['Taller'] if not pd.isna(r_match['Taller']) and str(r_match['Taller']).lower() != 'nan' else 'Sin Taller',
                                'estado': 'ADELANTADO',
                                'observaciones': 'Ejecutado por adelantado en ' + months[mes_ejec-1] + ' (Programado: ' + months[mes_orig-1] + ')'
                            })
                            item_id += 1
                        else:
                            results.append({
                                'id': item_id,
                                'patente': pat,
                                'centro_costo': cc,
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
            else:
                # Rollover check
                prev_executed = [res for res in results if res['patente'] == pat and res['estado'] in ['FUERA_DE_TERMINO', 'ADELANTADO']]
                is_rollover = False
                for prev in prev_executed:
                    if prev['mes_ejecucion'] == mes_orig or (not pd.isna(fecha_est) and abs((fecha_est - pd.to_datetime(prev['fecha_ejecucion'])).days) <= 45):
                        is_rollover = True
                        break
                
                if not is_rollover:
                    prev_pending = [res for res in results if res['patente'] == pat and res['estado'] == 'PENDIENTE']
                    for prev in prev_pending:
                        if prev['mes_original'] == mes_orig - 1 or (mes_orig - prev['mes_original'] <= 2 and mes_orig <= 7):
                            is_rollover = True
                            break

                if not is_rollover:
                    results.append({
                        'id': item_id,
                        'patente': pat,
                        'centro_costo': cc,
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

    # Unmatched executions (extra / unprogrammed executions) -> Classified as ADELANTADO
    unmatched_real = df_real[~df_real.index.isin(r_used)]
    for r_idx, r_row in unmatched_real.iterrows():
        pat = r_row['Patente']
        cc = r_row['CC']
        plan = r_row['Plan'] if not pd.isna(r_row['Plan']) else 'Mantenimiento Preventivo Extra'
        fecha_real = r_row['Fecha_Real']
        mes_ejec = int(r_row['Mes_Ejec']) if not pd.isna(r_row['Mes_Ejec']) else 1
        taller = r_row['Taller'] if not pd.isna(r_row['Taller']) and str(r_row['Taller']).lower() != 'nan' else 'Sin Taller'

        results.append({
            'id': item_id,
            'patente': pat,
            'centro_costo': cc,
            'plan': plan,
            'fecha_estimada': fecha_real.strftime('%Y-%m-%d') if not pd.isna(fecha_real) else '2026-01-01',
            'mes_original': mes_ejec,
            'fecha_ejecucion': fecha_real.strftime('%Y-%m-%d') if not pd.isna(fecha_real) else '2026-01-01',
            'mes_ejecucion': mes_ejec,
            'taller': taller,
            'estado': 'ADELANTADO',
            'observaciones': 'Ejecutado sin programación previa en ' + months[mes_ejec-1]
        })
        item_id += 1

    output = {
        'centros_de_costo': ccs,
        'talleres': talleres,
        'vehiculos': vehicles,
        'mantenimientos': results
    }

    os.makedirs('data', exist_ok=True)
    with open('data/maintenance_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Data parsed with ADELANTADOS classification: {len(ccs)} CCs, {len(talleres)} Talleres, {len(vehicles)} Vehicles, {len(results)} Mantenimientos.")

if __name__ == '__main__':
    parse_data()
