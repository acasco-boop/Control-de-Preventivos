# Control de Mantenimiento Preventivo 2026

Dashboard web interactivo para el control y seguimiento de Mantenimientos Preventivos Proyectados vs. Ejecutados 2026 por Centro de Costo (CdC) y Taller.

## 🚀 Características
- **Filtros Avanzados:** Selección múltiple de Centros de Costo, Selección múltiple de Talleres, Mes de Evaluación y Búsqueda por Patente.
- **Tarjetas de KPI y Gráficos:** Cumplimiento YTD, % Cumplimiento en Término, % Ejecución Total (incluyendo preventivos adelantados y regularizaciones de meses anteriores) y Distribución por Estado.
- **Control de Mecánico:** Casillas de verificación para marcar preventivos realizados (resaltado verde esmeralda y naranja fuera de término), notas libres de aclaración y **protección con clave de autorización (`4321`)** para desmarcar.
- **Exportación CSV:** 1-clic para descargar el reporte consolidado.

## 🛠️ Ejecución Local
```bash
python -m http.server 5000 --bind 0.0.0.0
```
Abrir en el navegador: `http://localhost:5000`
