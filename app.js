// App State & Data Management Engine with Clean Monthly Filtering, CdC, Talleres, Mechanic Notes & Modals
document.addEventListener('DOMContentLoaded', async () => {
    let globalData = {
        centros_de_costo: [],
        talleres: [],
        talleres_proyectados: [],
        vehiculos: [],
        mantenimientos: []
    };

    let selectedCdcs = new Set();
    let selectedTalleres = new Set();
    let selectedTalleresProyectados = new Set();

    // Password required to uncheck ANY completed item
    const UNCHECK_PASSWORD = '4321';

    // Mechanic State persistence via localStorage
    let mechanicState = {};
    try {
        const savedState = localStorage.getItem('mechanic_state_v1');
        if (savedState) {
            mechanicState = JSON.parse(savedState);
        }
    } catch (e) {
        console.error('Error al leer mechanic_state:', e);
    }

    let pendingAction = null; // Store active modal target state

    let monthlyChartInstance = null;
    let statusChartInstance = null;

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // DOM Elements - CdC Multi-Select
    const cdcTrigger = document.getElementById('cdcTrigger');
    const cdcDropdown = document.getElementById('cdcDropdown');
    const cdcTriggerText = document.getElementById('cdcTriggerText');
    const cdcOptionsList = document.getElementById('cdcOptionsList');
    const cdcSearchInput = document.getElementById('cdcSearchInput');
    const selectAllCdcBtn = document.getElementById('selectAllCdcBtn');
    const deselectAllCdcBtn = document.getElementById('deselectAllCdcBtn');

    // DOM Elements - Taller Proyectado Multi-Select
    const tallerProyTrigger = document.getElementById('tallerProyTrigger');
    const tallerProyDropdown = document.getElementById('tallerProyDropdown');
    const tallerProyTriggerText = document.getElementById('tallerProyTriggerText');
    const tallerProyOptionsList = document.getElementById('tallerProyOptionsList');
    const selectAllTallerProyBtn = document.getElementById('selectAllTallerProyBtn');
    const deselectAllTallerProyBtn = document.getElementById('deselectAllTallerProyBtn');

    // DOM Elements - Taller Realizado Multi-Select
    const tallerTrigger = document.getElementById('tallerTrigger');
    const tallerDropdown = document.getElementById('tallerDropdown');
    const tallerTriggerText = document.getElementById('tallerTriggerText');
    const tallerOptionsList = document.getElementById('tallerOptionsList');
    const selectAllTallerBtn = document.getElementById('selectAllTallerBtn');
    const deselectAllTallerBtn = document.getElementById('deselectAllTallerBtn');

    const monthFilter = document.getElementById('monthFilter');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const tableBody = document.getElementById('tableBody');

    // Modals DOM Elements
    const confirmModal = document.getElementById('confirmModal');
    const confirmModalText = document.getElementById('confirmModalText');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmOkBtn = document.getElementById('confirmOkBtn');

    const passModal = document.getElementById('passModal');
    const passInput = document.getElementById('passInput');
    const passErrorMsg = document.getElementById('passErrorMsg');
    const passCancelBtn = document.getElementById('passCancelBtn');
    const passOkBtn = document.getElementById('passOkBtn');

    // Load Data
    try {
        const response = await fetch('data/maintenance_data.json');
        globalData = await response.json();
        initDashboard();
    } catch (error) {
        console.error('Error al cargar maintenance_data.json:', error);
    }

    function initDashboard() {
        populateCdcMultiselectOptions();
        populateTallerProyectadoMultiselectOptions();
        populateTallerMultiselectOptions();
        setupEventListeners();
        setupModalEventListeners();
        updateDashboard();
    }

    function saveMechanicState() {
        try {
            localStorage.setItem('mechanic_state_v1', JSON.stringify(mechanicState));
        } catch (e) {
            console.error('Error al guardar mechanic_state:', e);
        }
    }

    function getItemCheckState(item) {
        if (mechanicState[item.id] !== undefined && mechanicState[item.id].checked !== undefined) {
            return mechanicState[item.id].checked;
        }
        return item.estado !== 'PENDIENTE';
    }

    function populateCdcMultiselectOptions() {
        cdcOptionsList.innerHTML = '';
        globalData.centros_de_costo.forEach(cdc => {
            const item = document.createElement('div');
            item.className = 'multiselect-option';
            item.dataset.cdc = cdc;

            const isChecked = selectedCdcs.has(cdc);

            item.innerHTML = `
                <input type="checkbox" id="cdc_chk_${sanitizeId(cdc)}" value="${escapeHtml(cdc)}" ${isChecked ? 'checked' : ''}>
                <label for="cdc_chk_${sanitizeId(cdc)}" style="cursor:pointer; width:100%;">${escapeHtml(cdc)}</label>
            `;

            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedCdcs.add(cdc);
                } else {
                    selectedCdcs.delete(cdc);
                }
                updateCdcTriggerText();
                updateDashboard();
            });

            cdcOptionsList.appendChild(item);
        });
        updateCdcTriggerText();
    }

    function populateTallerProyectadoMultiselectOptions() {
        tallerProyOptionsList.innerHTML = '';
        (globalData.talleres_proyectados || []).forEach(taller => {
            const item = document.createElement('div');
            item.className = 'multiselect-option';
            item.dataset.tallerproy = taller;

            const isChecked = selectedTalleresProyectados.has(taller);

            item.innerHTML = `
                <input type="checkbox" id="tallerproy_chk_${sanitizeId(taller)}" value="${escapeHtml(taller)}" ${isChecked ? 'checked' : ''}>
                <label for="tallerproy_chk_${sanitizeId(taller)}" style="cursor:pointer; width:100%;">${escapeHtml(taller)}</label>
            `;

            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedTalleresProyectados.add(taller);
                } else {
                    selectedTalleresProyectados.delete(taller);
                }
                updateTallerProyTriggerText();
                updateDashboard();
            });

            tallerProyOptionsList.appendChild(item);
        });
        updateTallerProyTriggerText();
    }

    function populateTallerMultiselectOptions() {
        tallerOptionsList.innerHTML = '';
        const allTalleres = [...(globalData.talleres || []), 'SIN_TALLER'];

        allTalleres.forEach(taller => {
            const item = document.createElement('div');
            item.className = 'multiselect-option';
            item.dataset.taller = taller;

            const isChecked = selectedTalleres.has(taller);
            const labelText = taller === 'SIN_TALLER' ? 'Sin Taller / Pendientes' : `Taller: ${taller}`;

            item.innerHTML = `
                <input type="checkbox" id="taller_chk_${sanitizeId(taller)}" value="${escapeHtml(taller)}" ${isChecked ? 'checked' : ''}>
                <label for="taller_chk_${sanitizeId(taller)}" style="cursor:pointer; width:100%;">${escapeHtml(labelText)}</label>
            `;

            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedTalleres.add(taller);
                } else {
                    selectedTalleres.delete(taller);
                }
                updateTallerTriggerText();
                updateDashboard();
            });

            tallerOptionsList.appendChild(item);
        });
        updateTallerTriggerText();
    }

    function updateCdcTriggerText() {
        const total = globalData.centros_de_costo.length;
        const count = selectedCdcs.size;

        if (count === 0 || count === total) {
            cdcTriggerText.textContent = "Todos los Centros de Costo";
        } else if (count === 1) {
            const singleVal = Array.from(selectedCdcs)[0];
            cdcTriggerText.textContent = singleVal;
        } else {
            cdcTriggerText.textContent = `${count} CdC Seleccionados`;
        }
    }

    function updateTallerProyTriggerText() {
        const total = globalData.talleres_proyectados ? globalData.talleres_proyectados.length : 0;
        const count = selectedTalleresProyectados.size;

        if (count === 0 || count === total) {
            tallerProyTriggerText.textContent = "Todos los Talleres Proyectados";
        } else if (count === 1) {
            const singleVal = Array.from(selectedTalleresProyectados)[0];
            tallerProyTriggerText.textContent = singleVal;
        } else {
            tallerProyTriggerText.textContent = `${count} Talleres Proyectados`;
        }
    }

    function updateTallerTriggerText() {
        const total = (globalData.talleres ? globalData.talleres.length : 0) + 1;
        const count = selectedTalleres.size;

        if (count === 0 || count === total) {
            tallerTriggerText.textContent = "Todos los Talleres Realizados";
        } else if (count === 1) {
            const singleVal = Array.from(selectedTalleres)[0];
            tallerTriggerText.textContent = singleVal === 'SIN_TALLER' ? 'Sin Taller' : singleVal;
        } else {
            tallerTriggerText.textContent = `${count} Talleres Realizados`;
        }
    }

    function sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9]/g, '_');
    }

    function setupEventListeners() {
        // Toggle CdC Dropdown
        cdcTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            tallerProyDropdown.classList.remove('show');
            tallerProyTrigger.classList.remove('active');
            tallerDropdown.classList.remove('show');
            tallerTrigger.classList.remove('active');
            cdcDropdown.classList.toggle('show');
            cdcTrigger.classList.toggle('active');
        });

        // Toggle Taller Proyectado Dropdown
        tallerProyTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            cdcDropdown.classList.remove('show');
            cdcTrigger.classList.remove('active');
            tallerDropdown.classList.remove('show');
            tallerTrigger.classList.remove('active');
            tallerProyDropdown.classList.toggle('show');
            tallerProyTrigger.classList.toggle('active');
        });

        // Toggle Taller Realizado Dropdown
        tallerTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            cdcDropdown.classList.remove('show');
            cdcTrigger.classList.remove('active');
            tallerProyDropdown.classList.remove('show');
            tallerProyTrigger.classList.remove('active');
            tallerDropdown.classList.toggle('show');
            tallerTrigger.classList.toggle('active');
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!cdcDropdown.contains(e.target) && !cdcTrigger.contains(e.target)) {
                cdcDropdown.classList.remove('show');
                cdcTrigger.classList.remove('active');
            }
            if (!tallerProyDropdown.contains(e.target) && !tallerProyTrigger.contains(e.target)) {
                tallerProyDropdown.classList.remove('show');
                tallerProyTrigger.classList.remove('active');
            }
            if (!tallerDropdown.contains(e.target) && !tallerTrigger.contains(e.target)) {
                tallerDropdown.classList.remove('show');
                tallerTrigger.classList.remove('active');
            }
        });

        // Search inside CdC options
        cdcSearchInput.addEventListener('input', () => {
            const q = cdcSearchInput.value.toLowerCase();
            const options = cdcOptionsList.querySelectorAll('.multiselect-option');
            options.forEach(opt => {
                const cdcName = opt.dataset.cdc.toLowerCase();
                opt.style.display = cdcName.includes(q) ? 'flex' : 'none';
            });
        });

        // CdC Select All / Deselect All
        selectAllCdcBtn.addEventListener('click', () => {
            selectedCdcs.clear();
            globalData.centros_de_costo.forEach(c => selectedCdcs.add(c));
            updateCdcCheckboxes();
            updateCdcTriggerText();
            updateDashboard();
        });

        deselectAllCdcBtn.addEventListener('click', () => {
            selectedCdcs.clear();
            updateCdcCheckboxes();
            updateCdcTriggerText();
            updateDashboard();
        });

        // Taller Proyectado Select All / Deselect All
        selectAllTallerProyBtn.addEventListener('click', () => {
            selectedTalleresProyectados.clear();
            (globalData.talleres_proyectados || []).forEach(t => selectedTalleresProyectados.add(t));
            updateTallerProyCheckboxes();
            updateTallerProyTriggerText();
            updateDashboard();
        });

        deselectAllTallerProyBtn.addEventListener('click', () => {
            selectedTalleresProyectados.clear();
            updateTallerProyCheckboxes();
            updateTallerProyTriggerText();
            updateDashboard();
        });

        // Taller Realizado Select All / Deselect All
        selectAllTallerBtn.addEventListener('click', () => {
            selectedTalleres.clear();
            (globalData.talleres || []).forEach(t => selectedTalleres.add(t));
            selectedTalleres.add('SIN_TALLER');
            updateTallerCheckboxes();
            updateTallerTriggerText();
            updateDashboard();
        });

        deselectAllTallerBtn.addEventListener('click', () => {
            selectedTalleres.clear();
            updateTallerCheckboxes();
            updateTallerTriggerText();
            updateDashboard();
        });

        monthFilter.addEventListener('change', updateDashboard);
        statusFilter.addEventListener('change', updateDashboard);
        searchInput.addEventListener('input', () => {
            clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
            updateDashboard();
        });
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            updateDashboard();
        });
        resetFiltersBtn.addEventListener('click', () => {
            selectedCdcs.clear();
            selectedTalleresProyectados.clear();
            selectedTalleres.clear();
            updateCdcCheckboxes();
            updateTallerProyCheckboxes();
            updateTallerCheckboxes();
            updateCdcTriggerText();
            updateTallerProyTriggerText();
            updateTallerTriggerText();
            monthFilter.value = '7'; // Default current month July
            statusFilter.value = 'ALL';
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            updateDashboard();
        });
        exportCsvBtn.addEventListener('click', exportToCsv);

        // Table Mechanic Checkbox Click Interceptor
        tableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('mechanic-check')) {
                e.preventDefault();
                const chk = e.target;
                const id = parseInt(chk.dataset.id);
                const item = globalData.mantenimientos.find(m => m.id === id);

                const isCurrentlyChecked = getItemCheckState(item);

                const patenteName = item ? item.patente : 'Unidad';
                const planName = item ? item.plan : 'Preventivo';

                if (!isCurrentlyChecked) {
                    pendingAction = { type: 'CHECK', targetCheckbox: chk, id: id, item: item };
                    confirmModalText.innerHTML = `¿Está seguro de marcar el mantenimiento preventivo de la patente <strong>${escapeHtml(patenteName)}</strong> (<em>${escapeHtml(planName)}</em>) como <strong>REALIZADO</strong>?`;
                    confirmModal.classList.add('show');
                } else {
                    pendingAction = { type: 'UNCHECK', targetCheckbox: chk, id: id, item: item };
                    passInput.value = '';
                    passErrorMsg.style.display = 'none';
                    passModal.classList.add('show');
                    setTimeout(() => passInput.focus(), 100);
                }
            }
        });

        // Note Input Listener
        tableBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('mechanic-note-input')) {
                const id = parseInt(e.target.dataset.id);
                if (!mechanicState[id]) mechanicState[id] = { checked: getItemCheckState(globalData.mantenimientos.find(m => m.id === id)), note: '' };
                mechanicState[id].note = e.target.value;
                saveMechanicState();
            }
        });
    }

    function setupModalEventListeners() {
        confirmCancelBtn.addEventListener('click', () => {
            confirmModal.classList.remove('show');
            pendingAction = null;
        });

        confirmOkBtn.addEventListener('click', () => {
            if (pendingAction && pendingAction.type === 'CHECK') {
                const { id, targetCheckbox, item } = pendingAction;
                if (!mechanicState[id]) mechanicState[id] = { checked: true, note: '' };
                mechanicState[id].checked = true;
                saveMechanicState();

                targetCheckbox.checked = true;
                const tr = targetCheckbox.closest('tr');
                if (tr) {
                    tr.classList.remove('row-completed-orange');
                    tr.classList.add(item && item.estado === 'FUERA_DE_TERMINO' ? 'row-completed-orange' : 'row-completed');
                }
            }
            confirmModal.classList.remove('show');
            pendingAction = null;
        });

        passCancelBtn.addEventListener('click', () => {
            passModal.classList.remove('show');
            pendingAction = null;
        });

        const executeUncheckPass = () => {
            const enteredPass = passInput.value.trim();
            if (enteredPass === UNCHECK_PASSWORD) {
                if (pendingAction && pendingAction.type === 'UNCHECK') {
                    const { id, targetCheckbox } = pendingAction;
                    if (!mechanicState[id]) mechanicState[id] = { checked: false, note: '' };
                    mechanicState[id].checked = false;
                    saveMechanicState();

                    targetCheckbox.checked = false;
                    const tr = targetCheckbox.closest('tr');
                    if (tr) {
                        tr.classList.remove('row-completed');
                        tr.classList.remove('row-completed-orange');
                    }
                }
                passModal.classList.remove('show');
                pendingAction = null;
            } else {
                passErrorMsg.style.display = 'block';
                passInput.focus();
                passInput.select();
            }
        };

        passOkBtn.addEventListener('click', executeUncheckPass);

        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeUncheckPass();
            }
        });
    }

    function updateCdcCheckboxes() {
        const checkboxes = cdcOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(chk => {
            chk.checked = selectedCdcs.has(chk.value);
        });
    }

    function updateTallerProyCheckboxes() {
        const checkboxes = tallerProyOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(chk => {
            chk.checked = selectedTalleresProyectados.has(chk.value);
        });
    }

    function updateTallerCheckboxes() {
        const checkboxes = tallerOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(chk => {
            chk.checked = selectedTalleres.has(chk.value);
        });
    }

    function isCdcMatch(itemCdc) {
        if (selectedCdcs.size === 0 || selectedCdcs.size === globalData.centros_de_costo.length) {
            return true;
        }
        return selectedCdcs.has(itemCdc);
    }

    function isTallerProyMatch(item) {
        const totalPossible = globalData.talleres_proyectados ? globalData.talleres_proyectados.length : 0;
        if (selectedTalleresProyectados.size === 0 || selectedTalleresProyectados.size === totalPossible) {
            return true;
        }

        if (selectedTalleresProyectados.has(item.taller_proyectado)) {
            return true;
        }

        if (item.talleres_proyectados_list && Array.isArray(item.talleres_proyectados_list)) {
            for (const t of item.talleres_proyectados_list) {
                if (selectedTalleresProyectados.has(t)) {
                    return true;
                }
            }
        }

        return false;
    }

    function isTallerMatch(itemTaller) {
        const totalPossible = (globalData.talleres ? globalData.talleres.length : 0) + 1;
        if (selectedTalleres.size === 0 || selectedTalleres.size === totalPossible) {
            return true;
        }

        const isSinTaller = !itemTaller || itemTaller === 'Sin Taller';
        if (isSinTaller) {
            return selectedTalleres.has('SIN_TALLER');
        }

        return selectedTalleres.has(itemTaller);
    }

    function getFilteredData() {
        const selectedMonth = monthFilter.value;
        const selectedStatus = statusFilter.value;
        const searchQuery = searchInput.value.trim().toUpperCase();

        return globalData.mantenimientos.filter(item => {
            if (!isCdcMatch(item.centro_costo)) {
                return false;
            }

            if (!isTallerProyMatch(item)) {
                return false;
            }

            if (!isTallerMatch(item.taller)) {
                return false;
            }

            if (selectedMonth !== 'ALL') {
                const m = parseInt(selectedMonth);
                const isOriginalMonth = item.mes_original === m;
                const isExecutedInMonth = item.mes_ejecucion === m;

                if (!isOriginalMonth && !isExecutedInMonth) {
                    return false;
                }
            }

            if (selectedStatus !== 'ALL' && item.estado !== selectedStatus) {
                return false;
            }

            if (searchQuery && !item.patente.includes(searchQuery)) {
                return false;
            }

            return true;
        });
    }

    function updateDashboard() {
        const selectedMonthStr = monthFilter.value;
        const selectedMonth = selectedMonthStr === 'ALL' ? 7 : parseInt(selectedMonthStr); // Current month July (7)

        const filteredList = getFilteredData();

        calculateAndRenderKpis(selectedMonth);
        renderCharts();
        renderTable(filteredList);
    }

    function calculateAndRenderKpis(evalMonth) {
        const cdcScope = globalData.mantenimientos.filter(m => 
            isCdcMatch(m.centro_costo) && 
            isTallerProyMatch(m) && 
            isTallerMatch(m.taller)
        );

        // 1. YTD Global
        const ytdProyectados = cdcScope.filter(m => m.mes_original <= evalMonth);
        const ytdEjecutados = cdcScope.filter(m => m.fecha_ejecucion !== null && m.mes_ejecucion <= evalMonth);

        const ytdPct = ytdProyectados.length > 0 
            ? ((ytdEjecutados.length / ytdProyectados.length) * 100).toFixed(1)
            : '0.0';

        document.getElementById('kpiYtdPct').textContent = `${ytdPct}%`;
        document.getElementById('barYtd').style.width = `${Math.min(ytdPct, 100)}%`;
        document.getElementById('kpiYtdDetail').textContent = `${ytdEjecutados.length} de ${ytdProyectados.length} proyectados a ${monthNames[evalMonth - 1]}`;

        // 2. Mes Seleccionado Metrics
        const proyectadosMes = cdcScope.filter(m => m.mes_original === evalMonth);
        
        const ejecutadosEnTerminoMes = proyectadosMes.filter(m => m.mes_ejecucion === evalMonth);
        const terminoPct = proyectadosMes.length > 0 
            ? ((ejecutadosEnTerminoMes.length / proyectadosMes.length) * 100).toFixed(1)
            : '0.0';

        document.getElementById('kpiTerminoPct').textContent = `${terminoPct}%`;
        document.getElementById('barTermino').style.width = `${Math.min(terminoPct, 100)}%`;
        document.getElementById('kpiTerminoDetail').textContent = `${ejecutadosEnTerminoMes.length} de ${proyectadosMes.length} preventivos a tiempo en ${monthNames[evalMonth - 1]}`;

        // 3. % Ejecución Total (Mes)
        const todosEjecutadosEnMes = cdcScope.filter(m => m.mes_ejecucion === evalMonth);
        const totalEjecucionPct = proyectadosMes.length > 0 
            ? ((todosEjecutadosEnMes.length / proyectadosMes.length) * 100).toFixed(1)
            : '0.0';

        document.getElementById('kpiTotalPct').textContent = `${totalEjecucionPct}%`;
        document.getElementById('barTotal').style.width = `${Math.min(totalEjecucionPct, 100)}%`;
        
        const recuperadosPrevios = todosEjecutadosEnMes.filter(m => m.mes_original < evalMonth).length;
        const adelantadosFuturos = todosEjecutadosEnMes.filter(m => m.mes_original > evalMonth).length;
        
        let detailText = `${todosEjecutadosEnMes.length} ejecutados en ${monthNames[evalMonth - 1]}`;
        let extrasList = [];
        if (recuperadosPrevios > 0) extrasList.push(`${recuperadosPrevios} regularizados`);
        if (adelantadosFuturos > 0) extrasList.push(`${adelantadosFuturos} adelantados`);
        if (extrasList.length > 0) {
            detailText += ` (${extrasList.join(', ')})`;
        }
        document.getElementById('kpiTotalDetail').textContent = detailText;

        // 4. Cantidad de Preventivos Atrasados / Pendientes a la fecha (Acumulados <= evalMonth)
        const atrasadosScope = cdcScope.filter(m => m.estado === 'PENDIENTE' && m.mes_original <= evalMonth);
        document.getElementById('kpiAtrasadosQty').textContent = atrasadosScope.length;
        const maxBarAtrasados = proyectadosMes.length > 0 ? (atrasadosScope.length / proyectadosMes.length) * 100 : 0;
        document.getElementById('barAtrasados').style.width = `${Math.min(maxBarAtrasados, 100)}%`;
        document.getElementById('kpiAtrasadosDetail').textContent = `Pendientes acumulados hasta ${monthNames[evalMonth - 1]}`;
    }

    function renderCharts() {
        const cdcScope = globalData.mantenimientos.filter(m => 
            isCdcMatch(m.centro_costo) && 
            isTallerProyMatch(m) && 
            isTallerMatch(m.taller)
        );

        const monthlyProy = new Array(12).fill(0);
        const monthlyEjec = new Array(12).fill(0);

        cdcScope.forEach(m => {
            if (m.mes_original >= 1 && m.mes_original <= 12) {
                monthlyProy[m.mes_original - 1]++;
            }
            if (m.mes_ejecucion >= 1 && m.mes_ejecucion <= 12) {
                monthlyEjec[m.mes_ejecucion - 1]++;
            }
        });

        const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
        if (monthlyChartInstance) monthlyChartInstance.destroy();

        monthlyChartInstance = new Chart(ctxMonthly, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [
                    {
                        label: 'Proyectado',
                        data: monthlyProy,
                        backgroundColor: 'rgba(59, 130, 246, 0.65)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Ejecutado (Incluye Adelantados)',
                        data: monthlyEjec,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });

        let enFechaCount = 0;
        let adelantadoCount = 0;
        let fueraTerminoCount = 0;
        let pendienteCount = 0;

        cdcScope.forEach(m => {
            if (m.estado === 'EN_FECHA') enFechaCount++;
            else if (m.estado === 'ADELANTADO') adelantadoCount++;
            else if (m.estado === 'FUERA_DE_TERMINO') fueraTerminoCount++;
            else if (m.estado === 'PENDIENTE') pendienteCount++;
        });

        const ctxStatus = document.getElementById('statusChart').getContext('2d');
        if (statusChartInstance) statusChartInstance.destroy();

        statusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['En Fecha', 'Adelantado (Anticipado)', 'Fuera de Término', 'Pendiente / Atrasado'],
                datasets: [{
                    data: [enFechaCount, adelantadoCount, fueraTerminoCount, pendienteCount],
                    backgroundColor: [
                        '#10b981',
                        '#06b6d4',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } }
                },
                cutout: '68%'
            }
        });
    }

    function renderTable(list) {
        const countBadge = document.getElementById('tableCountBadge');
        tableBody.innerHTML = '';
        countBadge.textContent = `${list.length} Registros`;

        if (list.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 8px;"></i><br>
                        No se encontraron mantenimientos preventivos con los filtros aplicados.
                    </td>
                </tr>`;
            return;
        }

        list.forEach(item => {
            const tr = document.createElement('tr');
            
            const isChecked = getItemCheckState(item);
            const mNote = mechanicState[item.id] ? mechanicState[item.id].note : '';

            if (isChecked) {
                if (item.estado === 'FUERA_DE_TERMINO') {
                    tr.classList.add('row-completed-orange');
                } else {
                    tr.classList.add('row-completed');
                }
            }

            const fechaEstFormatted = item.fecha_estimada ? formatDate(item.fecha_estimada) : '-';
            const fechaEjecFormatted = item.fecha_ejecucion ? formatDate(item.fecha_ejecucion) : '-';
            const mesOrigName = monthNames[item.mes_original - 1] || 'N/A';

            let badgeHtml = '';
            if (item.estado === 'EN_FECHA') {
                badgeHtml = `<span class="badge badge-en-fecha"><i class="fa-solid fa-circle-check"></i> En fecha</span>`;
            } else if (item.estado === 'ADELANTADO') {
                badgeHtml = `<span class="badge badge-adelantado"><i class="fa-solid fa-bolt-lightning"></i> Adelantado</span>`;
            } else if (item.estado === 'FUERA_DE_TERMINO') {
                badgeHtml = `<span class="badge badge-fuera-termino"><i class="fa-solid fa-clock-rotate-left"></i> Fuera de término</span>`;
            } else {
                badgeHtml = `<span class="badge badge-pendiente"><i class="fa-solid fa-triangle-exclamation"></i> Pendiente</span>`;
            }

            let obsClass = 'obs-tag';
            if (item.estado === 'FUERA_DE_TERMINO' || item.estado === 'ADELANTADO') {
                obsClass = 'obs-tag obs-tag-highlight';
            }

            const tallerProyBadge = item.taller_proyectado 
                ? `<span class="taller-proy-tag"><i class="fa-solid fa-clipboard-list"></i> ${escapeHtml(item.taller_proyectado)}</span>` 
                : `<span class="taller-tag-none">-</span>`;

            const tallerBadge = item.taller && item.taller !== 'Sin Taller' 
                ? `<span class="taller-tag"><i class="fa-solid fa-wrench"></i> ${escapeHtml(item.taller)}</span>` 
                : `<span class="taller-tag-none">-</span>`;

            tr.innerHTML = `
                <td class="mechanic-check-cell">
                    <input type="checkbox" class="mechanic-check" data-id="${item.id}" ${isChecked ? 'checked' : ''} title="Marcar/Desmarcar mantenimiento">
                </td>
                <td><strong>${escapeHtml(item.centro_costo)}</strong></td>
                <td><span class="patente-code">${escapeHtml(item.patente)}</span></td>
                <td>${escapeHtml(item.plan)}</td>
                <td>${mesOrigName} (${fechaEstFormatted})</td>
                <td>${badgeHtml}</td>
                <td>${tallerProyBadge}</td>
                <td>${tallerBadge}</td>
                <td>${fechaEjecFormatted}</td>
                <td><span class="${obsClass}">${escapeHtml(item.observaciones)}</span></td>
                <td>
                    <input type="text" class="mechanic-note-input" data-id="${item.id}" placeholder="Escribir nota del mecánico..." value="${escapeHtml(mNote || '')}">
                </td>
            `;

            tableBody.appendChild(tr);
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

    function exportToCsv() {
        const dataToExport = getFilteredData();
        if (dataToExport.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM
        csvContent += "Listo (Mecánico);Centro de Costo;Patente;Plan;Mes Original;Fecha Estimada;Estado;Taller Proyectado;Taller Realizado;Fecha Ejecución;Observaciones;Nota Mecánico\n";

        dataToExport.forEach(item => {
            const isChecked = getItemCheckState(item);
            const mNote = mechanicState[item.id] ? mechanicState[item.id].note : '';
            const row = [
                `"${isChecked ? 'SÍ' : 'NO'}"`,
                `"${item.centro_costo}"`,
                `"${item.patente}"`,
                `"${item.plan}"`,
                `"${monthNames[item.mes_original - 1]}"`,
                `"${item.fecha_estimada || ''}"`,
                `"${item.estado}"`,
                `"${item.taller_proyectado || 'Sin Taller Proyectado'}"`,
                `"${item.taller || 'Sin Taller'}"`,
                `"${item.fecha_ejecucion || ''}"`,
                `"${item.observaciones}"`,
                `"${(mNote || '').replace(/"/g, '""')}"`
            ].join(";");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Preventivos_2026_Export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
