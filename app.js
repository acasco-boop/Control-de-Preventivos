// App State & Data Management Engine with Bulletproof Check Persist & Multi-PC Synchronization
document.addEventListener('DOMContentLoaded', async () => {
    let globalData = {
        centros_de_costo: [],
        talleres: [],
        talleres_proyectados: [],
        vehiculos: [],
        mantenimientos: []
    };

    let budgetData = {
        centros_de_costo: [],
        talleres: [],
        talleres_proyectados: [],
        vehiculos: [],
        mantenimientos: []
    };

    let selectedCdcs = new Set();
    let selectedTalleres = new Set();
    let selectedTalleresProyectados = new Set();

    // Presupuesto filter state
    let presuSelectedCdcs = new Set();
    let presuSelectedTalleres = new Set();
    let presuSelectedTalleresProyectados = new Set();

    // Password required to uncheck ANY completed item
    const UNCHECK_PASSWORD = '4321';

    // Mechanic State persistence (Dual Sync: Server + LocalStorage)
    let mechanicState = {};

    async function loadMechanicState() {
        let localState = {};
        try {
            const savedState = localStorage.getItem('mechanic_state_v1');
            if (savedState) {
                localState = JSON.parse(savedState);
            }
        } catch (e) {
            console.error('Error al leer mechanic_state local:', e);
        }

        let serverState = {};
        try {
            const resp = await fetch('/api/mechanic_state?t=' + Date.now(), { cache: 'no-store' });
            if (resp.ok) {
                serverState = await resp.json();
            }
        } catch (e) {
            console.warn('Servidor API no respondió, usando estado local.');
        }

        // Server state overrides local state so all PCs stay 100% in sync
        mechanicState = { ...localState, ...serverState };

        // Save merged state back to localStorage
        try {
            localStorage.setItem('mechanic_state_v1', JSON.stringify(mechanicState));
        } catch (e) {}
    }

    async function saveMechanicState() {
        try {
            localStorage.setItem('mechanic_state_v1', JSON.stringify(mechanicState));
        } catch (e) {
            console.error('Error al guardar mechanic_state en localStorage:', e);
        }

        try {
            await fetch('/api/mechanic_state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mechanicState)
            });
        } catch (e) {
            console.warn('No se pudo sincronizar el estado del mecánico con el servidor:', e);
        }
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

    // Tab Navigation DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const filterToolbarEl = document.querySelector('.filter-toolbar');
    const kpiGrid = document.querySelector('.kpi-grid');
    const chartsGrid = document.querySelector('.charts-grid');
    const mainTableSection = document.querySelector('.app-container > .table-section');
    const realizadosTab = document.getElementById('realizadosTab');

    // Realizados Tab DOM Elements
    const realizadosMonthFilter = document.getElementById('realizadosMonthFilter');
    const realizadosEstadoFilter = document.getElementById('realizadosEstadoFilter');
    const realizadosSearchInput = document.getElementById('realizadosSearchInput');
    const realizadosClearSearchBtn = document.getElementById('realizadosClearSearchBtn');
    const realizadosTableBody = document.getElementById('realizadosTableBody');
    const realizadosTableCountBadge = document.getElementById('realizadosTableCountBadge');
    const realizadosExportCsvBtn = document.getElementById('realizadosExportCsvBtn');
    const realizadosCountBadge = document.getElementById('realizadosCountBadge');

    // Presupuesto Tab DOM Elements
    const presupuestoTab = document.getElementById('presupuestoTab');
    const presuCdcTrigger = document.getElementById('presuCdcTrigger');
    const presuCdcDropdown = document.getElementById('presuCdcDropdown');
    const presuCdcTriggerText = document.getElementById('presuCdcTriggerText');
    const presuCdcOptionsList = document.getElementById('presuCdcOptionsList');
    const presuCdcSearchInput = document.getElementById('presuCdcSearchInput');
    const presuSelectAllCdcBtn = document.getElementById('presuSelectAllCdcBtn');
    const presuDeselectAllCdcBtn = document.getElementById('presuDeselectAllCdcBtn');

    const presuTallerProyTrigger = document.getElementById('presuTallerProyTrigger');
    const presuTallerProyDropdown = document.getElementById('presuTallerProyDropdown');
    const presuTallerProyTriggerText = document.getElementById('presuTallerProyTriggerText');
    const presuTallerProyOptionsList = document.getElementById('presuTallerProyOptionsList');
    const presuSelectAllTallerProyBtn = document.getElementById('presuSelectAllTallerProyBtn');
    const presuDeselectAllTallerProyBtn = document.getElementById('presuDeselectAllTallerProyBtn');

    const presuTallerTrigger = document.getElementById('presuTallerTrigger');
    const presuTallerDropdown = document.getElementById('presuTallerDropdown');
    const presuTallerTriggerText = document.getElementById('presuTallerTriggerText');
    const presuTallerOptionsList = document.getElementById('presuTallerOptionsList');
    const presuSelectAllTallerBtn = document.getElementById('presuSelectAllTallerBtn');
    const presuDeselectAllTallerBtn = document.getElementById('presuDeselectAllTallerBtn');

    const presuMonthFilter = document.getElementById('presuMonthFilter');
    const presuStatusFilter = document.getElementById('presuStatusFilter');
    const presuSearchInput = document.getElementById('presuSearchInput');
    const presuClearSearchBtn = document.getElementById('presuClearSearchBtn');
    const presuExportCsvBtn = document.getElementById('presuExportCsvBtn');
    const presuTableBody = document.getElementById('presuTableBody');

    // Presupuesto Charts
    let presuMonthlyChartInstance = null;
    let presuStatusChartInstance = null;

    // Análisis Tab DOM Elements
    const analisisTab = document.getElementById('analisisTab');
    const analisisPasswordGate = document.getElementById('analisisPasswordGate');
    const analisisContent = document.getElementById('analisisContent');
    const analisisPassInput = document.getElementById('analisisPassInput');
    const analisisPassBtn = document.getElementById('analisisPassBtn');
    const analisisPassError = document.getElementById('analisisPassError');
    let analisisMonthlyChartInstance = null;
    let analisisAuthenticated = false;

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

    // Load Data & Shared State
    try {
        await loadMechanicState();
        const [mainResponse, budgetResponse] = await Promise.all([
            fetch('data/maintenance_data.json?t=' + Date.now()),
            fetch('data/budget_data.json?t=' + Date.now())
        ]);
        globalData = await mainResponse.json();
        budgetData = await budgetResponse.json();
        initDashboard();
    } catch (error) {
        console.error('Error al cargar datos e inicializar dashboard:', error);
    }

    function initDashboard() {
        populateCdcMultiselectOptions();
        populateTallerProyectadoMultiselectOptions();
        populateTallerMultiselectOptions();

        // Default filters: Taller Proyectado = BSAS / SRAF, CdC = all except "Sin Operación" and "Sin Centro de Costo"
        selectedTalleresProyectados.clear();
        selectedTalleresProyectados.add('BSAS');
        selectedTalleresProyectados.add('BSAS / SRAF');
        updateTallerProyCheckboxes();
        updateTallerProyTriggerText();

        selectedTalleres.clear();
        updateTallerCheckboxes();
        updateTallerTriggerText();

        selectedCdcs.clear();
        globalData.centros_de_costo.forEach(cdc => {
            if (cdc !== 'Sin Operación' && cdc !== 'Sin Centro de Costo') {
                selectedCdcs.add(cdc);
            }
        });
        updateCdcCheckboxes();
        updateCdcTriggerText();

        // Initialize Presupuesto dashboard
        populatePresuCdcMultiselectOptions();
        populatePresuTallerProyectadoMultiselectOptions();
        populatePresuTallerMultiselectOptions();

        // Default Presupuesto filters: same as main dashboard
        presuSelectedTalleresProyectados.clear();
        presuSelectedTalleresProyectados.add('BSAS');
        presuSelectedTalleresProyectados.add('BSAS / SRAF');
        updatePresuTallerProyCheckboxes();
        updatePresuTallerProyTriggerText();

        presuSelectedTalleres.clear();
        updatePresuTallerCheckboxes();
        updatePresuTallerTriggerText();

        presuSelectedCdcs.clear();
        budgetData.centros_de_costo.forEach(cdc => {
            if (cdc !== 'Sin Operación' && cdc !== 'Sin Centro de Costo') {
                presuSelectedCdcs.add(cdc);
            }
        });
        updatePresuCdcCheckboxes();
        updatePresuCdcTriggerText();

        setupEventListeners();
        setupModalEventListeners();
        setupTabNavigation();
        updateDashboard();
        updatePresupuestoDashboard();
        updateRealizadosTab();
    }

    function getItemCheckState(item) {
        if (!item) return false;
        const key = String(item.id);
        if (mechanicState[key] !== undefined && mechanicState[key].checked !== undefined) {
            return mechanicState[key].checked;
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
                refreshAllViews();
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
                refreshAllViews();
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
                refreshAllViews();
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
            refreshAllViews();
        });

        deselectAllCdcBtn.addEventListener('click', () => {
            selectedCdcs.clear();
            updateCdcCheckboxes();
            updateCdcTriggerText();
            refreshAllViews();
        });

        // Taller Proyectado Select All / Deselect All
        selectAllTallerProyBtn.addEventListener('click', () => {
            selectedTalleresProyectados.clear();
            (globalData.talleres_proyectados || []).forEach(t => selectedTalleresProyectados.add(t));
            updateTallerProyCheckboxes();
            updateTallerProyTriggerText();
            refreshAllViews();
        });

        deselectAllTallerProyBtn.addEventListener('click', () => {
            selectedTalleresProyectados.clear();
            updateTallerProyCheckboxes();
            updateTallerProyTriggerText();
            refreshAllViews();
        });

        // Taller Realizado Select All / Deselect All
        selectAllTallerBtn.addEventListener('click', () => {
            selectedTalleres.clear();
            (globalData.talleres || []).forEach(t => selectedTalleres.add(t));
            selectedTalleres.add('SIN_TALLER');
            updateTallerCheckboxes();
            updateTallerTriggerText();
            refreshAllViews();
        });

        deselectAllTallerBtn.addEventListener('click', () => {
            selectedTalleres.clear();
            updateTallerCheckboxes();
            updateTallerTriggerText();
            refreshAllViews();
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
            // Reset to defaults: Taller Proyectado = BSAS / SRAF, CdC = all except "Sin Operación" and "Sin Centro de Costo"
            selectedCdcs.clear();
            globalData.centros_de_costo.forEach(cdc => {
                if (cdc !== 'Sin Operación' && cdc !== 'Sin Centro de Costo') {
                    selectedCdcs.add(cdc);
                }
            });
            selectedTalleresProyectados.clear();
            selectedTalleresProyectados.add('BSAS');
            selectedTalleresProyectados.add('BSAS / SRAF');
            selectedTalleres.clear();
            updateCdcCheckboxes();
            updateTallerProyCheckboxes();
            updateTallerCheckboxes();
            updateCdcTriggerText();
            updateTallerProyTriggerText();
            updateTallerTriggerText();
            monthFilter.value = '8'; // Default current month August
            statusFilter.value = 'ALL';
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            refreshAllViews();
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
                const key = String(id);
                const item = globalData.mantenimientos.find(m => m.id === id);
                const existingNote = e.target.value;
                if (!mechanicState[key]) {
                    mechanicState[key] = { checked: getItemCheckState(item), note: existingNote };
                } else {
                    mechanicState[key].note = existingNote;
                }
                saveMechanicState();
            }
        });
    }

    function setupModalEventListeners() {
        confirmCancelBtn.addEventListener('click', () => {
            confirmModal.classList.remove('show');
            pendingAction = null;
        });

        confirmOkBtn.addEventListener('click', async () => {
            if (pendingAction && pendingAction.type === 'CHECK') {
                const { id, targetCheckbox, item } = pendingAction;
                const key = String(id);
                const existingNote = mechanicState[key] ? mechanicState[key].note || '' : '';
                
                mechanicState[key] = { checked: true, note: existingNote };
                await saveMechanicState();

                if (targetCheckbox) {
                    targetCheckbox.checked = true;
                }
                refreshAllViews();
            }
            confirmModal.classList.remove('show');
            pendingAction = null;
        });

        passCancelBtn.addEventListener('click', () => {
            passModal.classList.remove('show');
            pendingAction = null;
        });

        const executeUncheckPass = async () => {
            const enteredPass = passInput.value.trim();
            if (enteredPass === UNCHECK_PASSWORD) {
                if (pendingAction && pendingAction.type === 'UNCHECK') {
                    const { id, targetCheckbox } = pendingAction;
                    const key = String(id);
                    const existingNote = mechanicState[key] ? mechanicState[key].note || '' : '';
                    
                    mechanicState[key] = { checked: false, note: existingNote };
                    await saveMechanicState();

                    if (targetCheckbox) {
                        targetCheckbox.checked = false;
                    }
                    refreshAllViews();
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

    function setupTabNavigation() {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (tab === 'dashboard') {
                    showDashboardTab();
                } else if (tab === 'presupuesto') {
                    showPresupuestoTab();
                } else if (tab === 'analisis') {
                    showAnalisisTab();
                } else if (tab === 'realizados') {
                    showRealizadosTab();
                }
            });
        });

        // Análisis password listeners
        analisisPassBtn.addEventListener('click', verifyAnalisisPassword);
        analisisPassInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyAnalisisPassword();
            }
        });

        // Presupuesto filter listeners
        presuCdcSearchInput.addEventListener('input', () => {
            const q = presuCdcSearchInput.value.toLowerCase();
            presuCdcOptionsList.querySelectorAll('.multiselect-option').forEach(opt => {
                opt.style.display = opt.dataset.cdc.toLowerCase().includes(q) ? 'flex' : 'none';
            });
        });
        presuSelectAllCdcBtn.addEventListener('click', () => {
            presuSelectedCdcs.clear();
            budgetData.centros_de_costo.forEach(c => presuSelectedCdcs.add(c));
            updatePresuCdcCheckboxes(); updatePresuCdcTriggerText(); updatePresupuestoDashboard();
        });
        presuDeselectAllCdcBtn.addEventListener('click', () => {
            presuSelectedCdcs.clear();
            updatePresuCdcCheckboxes(); updatePresuCdcTriggerText(); updatePresupuestoDashboard();
        });
        presuSelectAllTallerProyBtn.addEventListener('click', () => {
            presuSelectedTalleresProyectados.clear();
            (budgetData.talleres_proyectados || []).forEach(t => presuSelectedTalleresProyectados.add(t));
            updatePresuTallerProyCheckboxes(); updatePresuTallerProyTriggerText(); updatePresupuestoDashboard();
        });
        presuDeselectAllTallerProyBtn.addEventListener('click', () => {
            presuSelectedTalleresProyectados.clear();
            updatePresuTallerProyCheckboxes(); updatePresuTallerProyTriggerText(); updatePresupuestoDashboard();
        });
        presuSelectAllTallerBtn.addEventListener('click', () => {
            presuSelectedTalleres.clear();
            (budgetData.talleres || []).forEach(t => presuSelectedTalleres.add(t));
            presuSelectedTalleres.add('SIN_TALLER');
            updatePresuTallerCheckboxes(); updatePresuTallerTriggerText(); updatePresupuestoDashboard();
        });
        presuDeselectAllTallerBtn.addEventListener('click', () => {
            presuSelectedTalleres.clear();
            updatePresuTallerCheckboxes(); updatePresuTallerTriggerText(); updatePresupuestoDashboard();
        });

        // Presupuesto dropdown toggles
        presuCdcTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            presuTallerProyDropdown.classList.remove('show'); presuTallerProyTrigger.classList.remove('active');
            presuTallerDropdown.classList.remove('show'); presuTallerTrigger.classList.remove('active');
            presuCdcDropdown.classList.toggle('show'); presuCdcTrigger.classList.toggle('active');
        });
        presuTallerProyTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            presuCdcDropdown.classList.remove('show'); presuCdcTrigger.classList.remove('active');
            presuTallerDropdown.classList.remove('show'); presuTallerTrigger.classList.remove('active');
            presuTallerProyDropdown.classList.toggle('show'); presuTallerProyTrigger.classList.toggle('active');
        });
        presuTallerTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            presuCdcDropdown.classList.remove('show'); presuCdcTrigger.classList.remove('active');
            presuTallerProyDropdown.classList.remove('show'); presuTallerProyTrigger.classList.remove('active');
            presuTallerDropdown.classList.toggle('show'); presuTallerTrigger.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!presuCdcDropdown.contains(e.target) && !presuCdcTrigger.contains(e.target)) {
                presuCdcDropdown.classList.remove('show'); presuCdcTrigger.classList.remove('active');
            }
            if (!presuTallerProyDropdown.contains(e.target) && !presuTallerProyTrigger.contains(e.target)) {
                presuTallerProyDropdown.classList.remove('show'); presuTallerProyTrigger.classList.remove('active');
            }
            if (!presuTallerDropdown.contains(e.target) && !presuTallerTrigger.contains(e.target)) {
                presuTallerDropdown.classList.remove('show'); presuTallerTrigger.classList.remove('active');
            }
        });

        presuMonthFilter.addEventListener('change', updatePresupuestoDashboard);
        presuStatusFilter.addEventListener('change', updatePresupuestoDashboard);
        presuSearchInput.addEventListener('input', () => {
            presuClearSearchBtn.style.display = presuSearchInput.value ? 'block' : 'none';
            updatePresupuestoDashboard();
        });
        presuClearSearchBtn.addEventListener('click', () => {
            presuSearchInput.value = '';
            presuClearSearchBtn.style.display = 'none';
            updatePresupuestoDashboard();
        });
        presuExportCsvBtn.addEventListener('click', exportPresuToCsv);

        // Presupuesto table mechanic checkbox listener
        presuTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('mechanic-check')) {
                e.preventDefault();
                const chk = e.target;
                const id = parseInt(chk.dataset.id);
                const item = budgetData.mantenimientos.find(m => m.id === id);
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

        // Presupuesto table note input listener
        presuTableBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('mechanic-note-input')) {
                const id = parseInt(e.target.dataset.id);
                const key = String(id);
                const item = budgetData.mantenimientos.find(m => m.id === id);
                const existingNote = e.target.value;
                if (!mechanicState[key]) {
                    mechanicState[key] = { checked: getItemCheckState(item), note: existingNote };
                } else {
                    mechanicState[key].note = existingNote;
                }
                saveMechanicState();
            }
        });

        realizadosMonthFilter.addEventListener('change', updateRealizadosTab);
        realizadosEstadoFilter.addEventListener('change', updateRealizadosTab);
        realizadosSearchInput.addEventListener('input', () => {
            realizadosClearSearchBtn.style.display = realizadosSearchInput.value ? 'block' : 'none';
            updateRealizadosTab();
        });
        realizadosClearSearchBtn.addEventListener('click', () => {
            realizadosSearchInput.value = '';
            realizadosClearSearchBtn.style.display = 'none';
            updateRealizadosTab();
        });
        realizadosExportCsvBtn.addEventListener('click', exportRealizadosToCsv);
    }

    function showDashboardTab() {
        realizadosTab.style.display = 'none';
        presupuestoTab.style.display = 'none';
        analisisTab.style.display = 'none';
        filterToolbarEl.style.display = '';
        kpiGrid.style.display = '';
        chartsGrid.style.display = '';
        mainTableSection.style.display = '';
    }

    function showPresupuestoTab() {
        realizadosTab.style.display = 'none';
        presupuestoTab.style.display = 'block';
        analisisTab.style.display = 'none';
        filterToolbarEl.style.display = 'none';
        kpiGrid.style.display = 'none';
        chartsGrid.style.display = 'none';
        mainTableSection.style.display = 'none';
        updatePresupuestoDashboard();
    }

    function showAnalisisTab() {
        realizadosTab.style.display = 'none';
        presupuestoTab.style.display = 'none';
        analisisTab.style.display = 'block';
        filterToolbarEl.style.display = 'none';
        kpiGrid.style.display = 'none';
        chartsGrid.style.display = 'none';
        mainTableSection.style.display = 'none';
        if (!analisisAuthenticated) {
            analisisPasswordGate.style.display = 'flex';
            analisisContent.style.display = 'none';
            analisisPassInput.value = '';
            analisisPassError.style.display = 'none';
        }
    }

    function showRealizadosTab() {
        realizadosTab.style.display = 'block';
        presupuestoTab.style.display = 'none';
        analisisTab.style.display = 'none';
        filterToolbarEl.style.display = 'none';
        kpiGrid.style.display = 'none';
        chartsGrid.style.display = 'none';
        mainTableSection.style.display = 'none';
        updateRealizadosTab();
    }

    function getRealizadosFilteredData() {
        const selectedMonth = realizadosMonthFilter.value;
        const selectedEstado = realizadosEstadoFilter.value;
        const searchQuery = realizadosSearchInput.value.trim().toUpperCase();

        return globalData.mantenimientos.filter(item => {
            // Only items that were actually executed (non-PENDIENTE)
            if (item.estado === 'PENDIENTE') return false;
            if (!item.fecha_ejecucion) return false;

            // Apply global filters: CdC, Taller Proyectado, Taller Realizado
            if (!isCdcMatch(item.centro_costo)) return false;
            if (!isTallerProyMatch(item)) return false;
            if (!isTallerMatch(item.taller)) return false;

            // Month of execution filter
            if (selectedMonth !== 'ALL') {
                const m = parseInt(selectedMonth);
                if (item.mes_ejecucion !== m) return false;
            }

            // Estado filter
            if (selectedEstado !== 'ALL' && item.estado !== selectedEstado) {
                return false;
            }

            // Search by patente
            if (searchQuery && !item.patente.includes(searchQuery)) {
                return false;
            }

            return true;
        });
    }

    function updateRealizadosTab() {
        const filtered = getRealizadosFilteredData();

        // Sort by execution date descending (most recent first)
        filtered.sort((a, b) => {
            if (a.fecha_ejecucion && b.fecha_ejecucion) {
                return b.fecha_ejecucion.localeCompare(a.fecha_ejecucion);
            }
            return 0;
        });

        renderRealizadosTable(filtered);
        updateRealizadosCountBadge();
    }

    function updateRealizadosCountBadge() {
        const allCompleted = globalData.mantenimientos.filter(m => m.estado !== 'PENDIENTE' && m.fecha_ejecucion);
        realizadosCountBadge.textContent = allCompleted.length;
    }

    function renderRealizadosTable(list) {
        realizadosTableCountBadge.textContent = `${list.length} Registros`;
        realizadosTableBody.innerHTML = '';

        if (list.length === 0) {
            realizadosTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 8px;"></i><br>
                        No se encontraron preventivos realizados con los filtros aplicados.
                    </td>
                </tr>`;
            return;
        }

        list.forEach(item => {
            const tr = document.createElement('tr');
            tr.classList.add('row-completed');

            const fechaEjecFormatted = item.fecha_ejecucion ? formatDate(item.fecha_ejecucion) : '-';
            const fechaEstFormatted = item.fecha_estimada ? formatDate(item.fecha_estimada) : '-';
            const mesOrigName = item.mes_original && item.mes_original >= 1 && item.mes_original <= 12
                ? monthNames[item.mes_original - 1] : 'N/A';
            const mesEjecName = item.mes_ejecucion && item.mes_ejecucion >= 1 && item.mes_ejecucion <= 12
                ? monthNames[item.mes_ejecucion - 1] : 'N/A';

            let badgeHtml = '';
            if (item.estado === 'FUERA_DE_TERMINO') {
                badgeHtml = `<span class="badge badge-fuera-termino"><i class="fa-solid fa-clock-rotate-left"></i> Fuera de término</span>`;
                tr.classList.add('row-completed-orange');
            } else if (item.estado === 'ADELANTADO') {
                badgeHtml = `<span class="badge badge-adelantado"><i class="fa-solid fa-bolt-lightning"></i> Adelantado</span>`;
            } else {
                badgeHtml = `<span class="badge badge-en-fecha"><i class="fa-solid fa-circle-check"></i> En Fecha</span>`;
            }

            const tallerProyBadge = item.taller_proyectado
                ? `<span class="taller-proy-tag"><i class="fa-solid fa-clipboard-list"></i> ${escapeHtml(item.taller_proyectado)}</span>`
                : `<span class="taller-tag-none">-</span>`;

            const tallerBadge = item.taller && item.taller !== 'Sin Taller'
                ? `<span class="taller-tag"><i class="fa-solid fa-wrench"></i> ${escapeHtml(item.taller)}</span>`
                : `<span class="taller-tag-none">-</span>`;

            tr.innerHTML = `
                <td><strong>${escapeHtml(item.centro_costo)}</strong></td>
                <td><span class="patente-code">${escapeHtml(item.patente)}</span></td>
                <td>${escapeHtml(item.plan)}</td>
                <td>${mesOrigName} (${fechaEstFormatted})</td>
                <td>${mesEjecName}</td>
                <td>${badgeHtml}</td>
                <td>${tallerProyBadge}</td>
                <td>${tallerBadge}</td>
                <td><strong>${fechaEjecFormatted}</strong></td>
                <td><span class="obs-tag">${escapeHtml(item.observaciones)}</span></td>
            `;

            realizadosTableBody.appendChild(tr);
        });
    }

    function exportRealizadosToCsv() {
        const dataToExport = getRealizadosFilteredData();
        if (dataToExport.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "Centro de Costo;Patente;Plan;Mes Programado;Mes Ejecución;Estado;Taller Proyectado;Taller Realizado;Fecha Ejecución;Observaciones\n";

        dataToExport.forEach(item => {
            const mesOrigName = item.mes_original && item.mes_original >= 1 && item.mes_original <= 12
                ? monthNames[item.mes_original - 1] : 'N/A';
            const mesEjecName = item.mes_ejecucion && item.mes_ejecucion >= 1 && item.mes_ejecucion <= 12
                ? monthNames[item.mes_ejecucion - 1] : 'N/A';
            const row = [
                `"${item.centro_costo}"`,
                `"${item.patente}"`,
                `"${item.plan}"`,
                `"${mesOrigName}"`,
                `"${mesEjecName}"`,
                `"${item.estado}"`,
                `"${item.taller_proyectado || 'Sin Taller Proyectado'}"`,
                `"${item.taller || 'Sin Taller'}"`,
                `"${item.fecha_ejecucion || ''}"`,
                `"${(item.observaciones || '').replace(/"/g, '""')}"`
            ].join(";");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Preventivos_Realizados_2026_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function refreshAllViews() {
        updateDashboard();
        updatePresupuestoDashboard();
        updateRealizadosTab();
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

    function getCdcScope() {
        return globalData.mantenimientos.filter(m =>
            isCdcMatch(m.centro_costo) &&
            isTallerProyMatch(m) &&
            isTallerMatch(m.taller)
        );
    }

    // Helper: pre-compute set of patentes that already have a completed (non-PENDIENTE) task in the given month
    function getPatentesCompletedInMonth(month) {
        const set = new Set();
        globalData.mantenimientos.forEach(it => {
            if (it.mes_ejecucion === month && it.estado !== 'PENDIENTE') {
                set.add(it.patente);
            }
        });
        return set;
    }

    // Helper: hide PENDIENTE tasks for the given month whose vehicle already has a completed task in that month
    function isPendingCoveredByLateExecution(item, month, patentesCompletedInMonth) {
        if (item.estado !== 'PENDIENTE') return false;
        if (item.mes_original !== month) return false;
        return patentesCompletedInMonth.has(item.patente);
    }

    function getFilteredData() {
        const selectedMonth = monthFilter.value;
        const selectedStatus = statusFilter.value;
        const searchQuery = searchInput.value.trim().toUpperCase();

        // Pre-compute: set of patentes that already have a completed (non-PENDIENTE) task in the selected month
        let patentesCompletedInMonth = new Set();
        if (selectedMonth !== 'ALL') {
            patentesCompletedInMonth = getPatentesCompletedInMonth(parseInt(selectedMonth));
        }

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

                // If this item is PENDIENTE for the selected month AND the vehicle already has a completed task in this month, hide it
                if (isPendingCoveredByLateExecution(item, m, patentesCompletedInMonth)) {
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
        const selectedMonth = selectedMonthStr === 'ALL' ? 8 : parseInt(selectedMonthStr); // Current month August (8)

        const filteredList = getFilteredData();

        // Sort table list ascending (De menor a mayor) by Centro de Costo (A-Z)
        filteredList.sort((a, b) => {
            const ccA = (a.centro_costo || '').toLowerCase();
            const ccB = (b.centro_costo || '').toLowerCase();
            if (ccA < ccB) return -1;
            if (ccA > ccB) return 1;
            if (a.mes_original !== b.mes_original) {
                return a.mes_original - b.mes_original;
            }
            return (a.patente || '').localeCompare(b.patente || '');
        });

        calculateAndRenderKpis(selectedMonth);
        renderCharts();
        renderTable(filteredList);
    }

    function calculateAndRenderKpis(evalMonth) {
        const patentesCompletedInMonth = getPatentesCompletedInMonth(evalMonth);
        const cdcScope = getCdcScope().filter(m => !isPendingCoveredByLateExecution(m, evalMonth, patentesCompletedInMonth));

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
        const evalMonth = monthFilter.value === 'ALL' ? 8 : parseInt(monthFilter.value);
        const patentesCompletedInMonth = getPatentesCompletedInMonth(evalMonth);
        const cdcScope = getCdcScope().filter(m => !isPendingCoveredByLateExecution(m, evalMonth, patentesCompletedInMonth));

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
            const key = String(item.id);
            const mNote = mechanicState[key] ? mechanicState[key].note : '';

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
            let obsText = item.observaciones;
            let obsClass = 'obs-tag';

            if (isChecked) {
                if (item.estado === 'FUERA_DE_TERMINO') {
                    badgeHtml = `<span class="badge badge-fuera-termino"><i class="fa-solid fa-clock-rotate-left"></i> Fuera de término</span>`;
                    obsClass = 'obs-tag obs-tag-highlight';
                } else if (item.estado === 'ADELANTADO') {
                    badgeHtml = `<span class="badge badge-adelantado"><i class="fa-solid fa-bolt-lightning"></i> Adelantado</span>`;
                    obsClass = 'obs-tag obs-tag-highlight';
                } else {
                    badgeHtml = `<span class="badge badge-en-fecha"><i class="fa-solid fa-circle-check"></i> Realizado</span>`;
                    obsClass = 'obs-tag';
                }
            } else {
                badgeHtml = `<span class="badge badge-pendiente"><i class="fa-solid fa-triangle-exclamation"></i> Pendiente</span>`;
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
                <td><span class="${obsClass}">${escapeHtml(obsText)}</span></td>
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
            const key = String(item.id);
            const mNote = mechanicState[key] ? mechanicState[key].note : '';
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

    // ========== PRESUPUESTO DASHBOARD FUNCTIONS ==========

    function populatePresuCdcMultiselectOptions() {
        presuCdcOptionsList.innerHTML = '';
        budgetData.centros_de_costo.forEach(cdc => {
            const item = document.createElement('div');
            item.className = 'multiselect-option';
            item.dataset.cdc = cdc;
            const isChecked = presuSelectedCdcs.has(cdc);
            item.innerHTML = `
                <input type="checkbox" id="presu_cdc_chk_${sanitizeId(cdc)}" value="${escapeHtml(cdc)}" ${isChecked ? 'checked' : ''}>
                <label for="presu_cdc_chk_${sanitizeId(cdc)}" style="cursor:pointer; width:100%;">${escapeHtml(cdc)}</label>
            `;
            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) { presuSelectedCdcs.add(cdc); } else { presuSelectedCdcs.delete(cdc); }
                updatePresuCdcTriggerText();
                updatePresupuestoDashboard();
            });
            presuCdcOptionsList.appendChild(item);
        });
        updatePresuCdcTriggerText();
    }

    function populatePresuTallerProyectadoMultiselectOptions() {
        presuTallerProyOptionsList.innerHTML = '';
        (budgetData.talleres_proyectados || []).forEach(taller => {
            const item = document.createElement('div');
            item.className = 'multiselect-option';
            item.dataset.tallerproy = taller;
            const isChecked = presuSelectedTalleresProyectados.has(taller);
            item.innerHTML = `
                <input type="checkbox" id="presu_tallerproy_chk_${sanitizeId(taller)}" value="${escapeHtml(taller)}" ${isChecked ? 'checked' : ''}>
                <label for="presu_tallerproy_chk_${sanitizeId(taller)}" style="cursor:pointer; width:100%;">${escapeHtml(taller)}</label>
            `;
            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) { presuSelectedTalleresProyectados.add(taller); } else { presuSelectedTalleresProyectados.delete(taller); }
                updatePresuTallerProyTriggerText();
                updatePresupuestoDashboard();
            });
            presuTallerProyOptionsList.appendChild(item);
        });
        updatePresuTallerProyTriggerText();
    }

    function populatePresuTallerMultiselectOptions() {
        presuTallerOptionsList.innerHTML = '';
        const allTalleres = [...(budgetData.talleres || []), 'SIN_TALLER'];
        allTalleres.forEach(taller => {
            const item = document.createElement('div');
            item.className = 'multiselect-option';
            item.dataset.taller = taller;
            const isChecked = presuSelectedTalleres.has(taller);
            const labelText = taller === 'SIN_TALLER' ? 'Sin Taller / Pendientes' : `Taller: ${taller}`;
            item.innerHTML = `
                <input type="checkbox" id="presu_taller_chk_${sanitizeId(taller)}" value="${escapeHtml(taller)}" ${isChecked ? 'checked' : ''}>
                <label for="presu_taller_chk_${sanitizeId(taller)}" style="cursor:pointer; width:100%;">${escapeHtml(labelText)}</label>
            `;
            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) { presuSelectedTalleres.add(taller); } else { presuSelectedTalleres.delete(taller); }
                updatePresuTallerTriggerText();
                updatePresupuestoDashboard();
            });
            presuTallerOptionsList.appendChild(item);
        });
        updatePresuTallerTriggerText();
    }

    function updatePresuCdcCheckboxes() {
        presuCdcOptionsList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.checked = presuSelectedCdcs.has(chk.value);
        });
    }

    function updatePresuTallerProyCheckboxes() {
        presuTallerProyOptionsList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.checked = presuSelectedTalleresProyectados.has(chk.value);
        });
    }

    function updatePresuTallerCheckboxes() {
        presuTallerOptionsList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.checked = presuSelectedTalleres.has(chk.value);
        });
    }

    function updatePresuCdcTriggerText() {
        const total = budgetData.centros_de_costo.length;
        const count = presuSelectedCdcs.size;
        if (count === 0 || count === total) {
            presuCdcTriggerText.textContent = "Todos los Centros de Costo";
        } else if (count === 1) {
            presuCdcTriggerText.textContent = Array.from(presuSelectedCdcs)[0];
        } else {
            presuCdcTriggerText.textContent = `${count} CdC Seleccionados`;
        }
    }

    function updatePresuTallerProyTriggerText() {
        const total = budgetData.talleres_proyectados ? budgetData.talleres_proyectados.length : 0;
        const count = presuSelectedTalleresProyectados.size;
        if (count === 0 || count === total) {
            presuTallerProyTriggerText.textContent = "Todos los Talleres Proyectados";
        } else if (count === 1) {
            presuTallerProyTriggerText.textContent = Array.from(presuSelectedTalleresProyectados)[0];
        } else {
            presuTallerProyTriggerText.textContent = `${count} Talleres Proyectados`;
        }
    }

    function updatePresuTallerTriggerText() {
        const total = (budgetData.talleres ? budgetData.talleres.length : 0) + 1;
        const count = presuSelectedTalleres.size;
        if (count === 0 || count === total) {
            presuTallerTriggerText.textContent = "Todos los Talleres Realizados";
        } else if (count === 1) {
            const singleVal = Array.from(presuSelectedTalleres)[0];
            presuTallerTriggerText.textContent = singleVal === 'SIN_TALLER' ? 'Sin Taller' : singleVal;
        } else {
            presuTallerTriggerText.textContent = `${count} Talleres Realizados`;
        }
    }

    function isPresuCdcMatch(itemCdc) {
        if (presuSelectedCdcs.size === 0 || presuSelectedCdcs.size === budgetData.centros_de_costo.length) return true;
        return presuSelectedCdcs.has(itemCdc);
    }

    function isPresuTallerProyMatch(item) {
        const totalPossible = budgetData.talleres_proyectados ? budgetData.talleres_proyectados.length : 0;
        if (presuSelectedTalleresProyectados.size === 0 || presuSelectedTalleresProyectados.size === totalPossible) return true;
        if (presuSelectedTalleresProyectados.has(item.taller_proyectado)) return true;
        if (item.talleres_proyectados_list && Array.isArray(item.talleres_proyectados_list)) {
            for (const t of item.talleres_proyectados_list) {
                if (presuSelectedTalleresProyectados.has(t)) return true;
            }
        }
        return false;
    }

    function isPresuTallerMatch(itemTaller) {
        const totalPossible = (budgetData.talleres ? budgetData.talleres.length : 0) + 1;
        if (presuSelectedTalleres.size === 0 || presuSelectedTalleres.size === totalPossible) return true;
        const isSinTaller = !itemTaller || itemTaller === 'Sin Taller';
        if (isSinTaller) return presuSelectedTalleres.has('SIN_TALLER');
        return presuSelectedTalleres.has(itemTaller);
    }

    function getPresuCdcScope() {
        return budgetData.mantenimientos.filter(m =>
            isPresuCdcMatch(m.centro_costo) &&
            isPresuTallerProyMatch(m) &&
            isPresuTallerMatch(m.taller)
        );
    }

    function getPresuPatentesCompletedInMonth(month) {
        const set = new Set();
        budgetData.mantenimientos.forEach(it => {
            if (it.mes_ejecucion === month && it.estado !== 'PENDIENTE') set.add(it.patente);
        });
        return set;
    }

    function isPresuPendingCoveredByLateExecution(item, month, patentesCompletedInMonth) {
        if (item.estado !== 'PENDIENTE') return false;
        if (item.mes_original !== month) return false;
        return patentesCompletedInMonth.has(item.patente);
    }

    function getPresuFilteredData() {
        const selectedMonth = presuMonthFilter.value;
        const selectedStatus = presuStatusFilter.value;
        const searchQuery = presuSearchInput.value.trim().toUpperCase();

        let patentesCompletedInMonth = new Set();
        if (selectedMonth !== 'ALL') {
            patentesCompletedInMonth = getPresuPatentesCompletedInMonth(parseInt(selectedMonth));
        }

        return budgetData.mantenimientos.filter(item => {
            if (!isPresuCdcMatch(item.centro_costo)) return false;
            if (!isPresuTallerProyMatch(item)) return false;
            if (!isPresuTallerMatch(item.taller)) return false;

            if (selectedMonth !== 'ALL') {
                const m = parseInt(selectedMonth);
                const isOriginalMonth = item.mes_original === m;
                const isExecutedInMonth = item.mes_ejecucion === m;
                if (!isOriginalMonth && !isExecutedInMonth) return false;
                if (isPresuPendingCoveredByLateExecution(item, m, patentesCompletedInMonth)) return false;
            }

            if (selectedStatus !== 'ALL' && item.estado !== selectedStatus) return false;
            if (searchQuery && !item.patente.includes(searchQuery)) return false;
            return true;
        });
    }

    function updatePresupuestoDashboard() {
        const selectedMonthStr = presuMonthFilter.value;
        const selectedMonth = selectedMonthStr === 'ALL' ? 8 : parseInt(selectedMonthStr);
        const filteredList = getPresuFilteredData();

        filteredList.sort((a, b) => {
            const ccA = (a.centro_costo || '').toLowerCase();
            const ccB = (b.centro_costo || '').toLowerCase();
            if (ccA < ccB) return -1;
            if (ccA > ccB) return 1;
            if (a.mes_original !== b.mes_original) return a.mes_original - b.mes_original;
            return (a.patente || '').localeCompare(b.patente || '');
        });

        calculateAndRenderPresuKpis(selectedMonth);
        renderPresuCharts();
        renderPresuTable(filteredList);
    }

    function calculateAndRenderPresuKpis(evalMonth) {
        const patentesCompletedInMonth = getPresuPatentesCompletedInMonth(evalMonth);
        const cdcScope = getPresuCdcScope().filter(m => !isPresuPendingCoveredByLateExecution(m, evalMonth, patentesCompletedInMonth));

        const ytdProyectados = cdcScope.filter(m => m.mes_original <= evalMonth);
        const ytdEjecutados = cdcScope.filter(m => m.fecha_ejecucion !== null && m.mes_ejecucion <= evalMonth);
        const ytdPct = ytdProyectados.length > 0 ? ((ytdEjecutados.length / ytdProyectados.length) * 100).toFixed(1) : '0.0';
        document.getElementById('presuKpiYtdPct').textContent = `${ytdPct}%`;
        document.getElementById('presuBarYtd').style.width = `${Math.min(ytdPct, 100)}%`;
        document.getElementById('presuKpiYtdDetail').textContent = `${ytdEjecutados.length} de ${ytdProyectados.length} proyectados a ${monthNames[evalMonth - 1]}`;

        const proyectadosMes = cdcScope.filter(m => m.mes_original === evalMonth);
        const ejecutadosEnTerminoMes = proyectadosMes.filter(m => m.mes_ejecucion === evalMonth);
        const terminoPct = proyectadosMes.length > 0 ? ((ejecutadosEnTerminoMes.length / proyectadosMes.length) * 100).toFixed(1) : '0.0';
        document.getElementById('presuKpiTerminoPct').textContent = `${terminoPct}%`;
        document.getElementById('presuBarTermino').style.width = `${Math.min(terminoPct, 100)}%`;
        document.getElementById('presuKpiTerminoDetail').textContent = `${ejecutadosEnTerminoMes.length} de ${proyectadosMes.length} preventivos a tiempo en ${monthNames[evalMonth - 1]}`;

        const todosEjecutadosEnMes = cdcScope.filter(m => m.mes_ejecucion === evalMonth);
        const totalEjecucionPct = proyectadosMes.length > 0 ? ((todosEjecutadosEnMes.length / proyectadosMes.length) * 100).toFixed(1) : '0.0';
        document.getElementById('presuKpiTotalPct').textContent = `${totalEjecucionPct}%`;
        document.getElementById('presuBarTotal').style.width = `${Math.min(totalEjecucionPct, 100)}%`;

        const recuperadosPrevios = todosEjecutadosEnMes.filter(m => m.mes_original < evalMonth).length;
        const adelantadosFuturos = todosEjecutadosEnMes.filter(m => m.mes_original > evalMonth).length;
        let detailText = `${todosEjecutadosEnMes.length} ejecutados en ${monthNames[evalMonth - 1]}`;
        let extrasList = [];
        if (recuperadosPrevios > 0) extrasList.push(`${recuperadosPrevios} regularizados`);
        if (adelantadosFuturos > 0) extrasList.push(`${adelantadosFuturos} adelantados`);
        if (extrasList.length > 0) detailText += ` (${extrasList.join(', ')})`;
        document.getElementById('presuKpiTotalDetail').textContent = detailText;

        const atrasadosScope = cdcScope.filter(m => m.estado === 'PENDIENTE' && m.mes_original <= evalMonth);
        document.getElementById('presuKpiAtrasadosQty').textContent = atrasadosScope.length;
        const maxBarAtrasados = proyectadosMes.length > 0 ? (atrasadosScope.length / proyectadosMes.length) * 100 : 0;
        document.getElementById('presuBarAtrasados').style.width = `${Math.min(maxBarAtrasados, 100)}%`;
        document.getElementById('presuKpiAtrasadosDetail').textContent = `Pendientes acumulados hasta ${monthNames[evalMonth - 1]}`;
    }

    function renderPresuCharts() {
        const evalMonth = presuMonthFilter.value === 'ALL' ? 8 : parseInt(presuMonthFilter.value);
        const patentesCompletedInMonth = getPresuPatentesCompletedInMonth(evalMonth);
        const cdcScope = getPresuCdcScope().filter(m => !isPresuPendingCoveredByLateExecution(m, evalMonth, patentesCompletedInMonth));

        const monthlyProy = new Array(12).fill(0);
        const monthlyEjec = new Array(12).fill(0);
        cdcScope.forEach(m => {
            if (m.mes_original >= 1 && m.mes_original <= 12) monthlyProy[m.mes_original - 1]++;
            if (m.mes_ejecucion >= 1 && m.mes_ejecucion <= 12) monthlyEjec[m.mes_ejecucion - 1]++;
        });

        const ctxMonthly = document.getElementById('presuMonthlyChart').getContext('2d');
        if (presuMonthlyChartInstance) presuMonthlyChartInstance.destroy();
        presuMonthlyChartInstance = new Chart(ctxMonthly, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [
                    { label: 'Presupuestado', data: monthlyProy, backgroundColor: 'rgba(59, 130, 246, 0.65)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 },
                    { label: 'Ejecutado (Incluye Adelantados)', data: monthlyEjec, backgroundColor: 'rgba(16, 185, 129, 0.75)', borderColor: '#10b981', borderWidth: 1, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });

        let enFechaCount = 0, adelantadoCount = 0, fueraTerminoCount = 0, pendienteCount = 0;
        cdcScope.forEach(m => {
            if (m.estado === 'EN_FECHA') enFechaCount++;
            else if (m.estado === 'ADELANTADO') adelantadoCount++;
            else if (m.estado === 'FUERA_DE_TERMINO') fueraTerminoCount++;
            else if (m.estado === 'PENDIENTE') pendienteCount++;
        });

        const ctxStatus = document.getElementById('presuStatusChart').getContext('2d');
        if (presuStatusChartInstance) presuStatusChartInstance.destroy();
        presuStatusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['En Fecha', 'Adelantado (Anticipado)', 'Fuera de Término', 'Pendiente / Atrasado'],
                datasets: [{ data: [enFechaCount, adelantadoCount, fueraTerminoCount, pendienteCount], backgroundColor: ['#10b981', '#06b6d4', '#f59e0b', '#ef4444'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, cutout: '68%' }
        });
    }

    function renderPresuTable(list) {
        const countBadge = document.getElementById('presuTableCountBadge');
        presuTableBody.innerHTML = '';
        countBadge.textContent = `${list.length} Registros`;

        if (list.length === 0) {
            presuTableBody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 30px;"><i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 8px;"></i><br>No se encontraron mantenimientos con los filtros aplicados.</td></tr>`;
            return;
        }

        list.forEach(item => {
            const tr = document.createElement('tr');
            const isChecked = getItemCheckState(item);
            const key = String(item.id);
            const mNote = mechanicState[key] ? mechanicState[key].note : '';

            if (isChecked) {
                if (item.estado === 'FUERA_DE_TERMINO') tr.classList.add('row-completed-orange');
                else tr.classList.add('row-completed');
            }

            const fechaEstFormatted = item.fecha_estimada ? formatDate(item.fecha_estimada) : '-';
            const fechaEjecFormatted = item.fecha_ejecucion ? formatDate(item.fecha_ejecucion) : '-';
            const mesOrigName = monthNames[item.mes_original - 1] || 'N/A';

            let badgeHtml = '';
            let obsClass = 'obs-tag';
            if (isChecked) {
                if (item.estado === 'FUERA_DE_TERMINO') {
                    badgeHtml = `<span class="badge badge-fuera-termino"><i class="fa-solid fa-clock-rotate-left"></i> Fuera de término</span>`;
                    obsClass = 'obs-tag obs-tag-highlight';
                } else if (item.estado === 'ADELANTADO') {
                    badgeHtml = `<span class="badge badge-adelantado"><i class="fa-solid fa-bolt-lightning"></i> Adelantado</span>`;
                    obsClass = 'obs-tag obs-tag-highlight';
                } else {
                    badgeHtml = `<span class="badge badge-en-fecha"><i class="fa-solid fa-circle-check"></i> Realizado</span>`;
                }
            } else {
                badgeHtml = `<span class="badge badge-pendiente"><i class="fa-solid fa-triangle-exclamation"></i> Pendiente</span>`;
            }

            const tallerProyBadge = item.taller_proyectado ? `<span class="taller-proy-tag"><i class="fa-solid fa-clipboard-list"></i> ${escapeHtml(item.taller_proyectado)}</span>` : `<span class="taller-tag-none">-</span>`;
            const tallerBadge = item.taller && item.taller !== 'Sin Taller' ? `<span class="taller-tag"><i class="fa-solid fa-wrench"></i> ${escapeHtml(item.taller)}</span>` : `<span class="taller-tag-none">-</span>`;

            tr.innerHTML = `
                <td class="mechanic-check-cell"><input type="checkbox" class="mechanic-check" data-id="${item.id}" ${isChecked ? 'checked' : ''} title="Marcar/Desmarcar mantenimiento"></td>
                <td><strong>${escapeHtml(item.centro_costo)}</strong></td>
                <td><span class="patente-code">${escapeHtml(item.patente)}</span></td>
                <td>${escapeHtml(item.plan)}</td>
                <td>${mesOrigName} (${fechaEstFormatted})</td>
                <td>${badgeHtml}</td>
                <td>${tallerProyBadge}</td>
                <td>${tallerBadge}</td>
                <td>${fechaEjecFormatted}</td>
                <td><span class="${obsClass}">${escapeHtml(item.observaciones)}</span></td>
                <td><input type="text" class="mechanic-note-input" data-id="${item.id}" placeholder="Escribir nota del mecánico..." value="${escapeHtml(mNote || '')}"></td>
            `;
            presuTableBody.appendChild(tr);
        });
    }

    function exportPresuToCsv() {
        const dataToExport = getPresuFilteredData();
        if (dataToExport.length === 0) { alert('No hay datos para exportar.'); return; }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "Listo (Mecánico);Centro de Costo;Patente;Plan;Mes Original;Fecha Estimada;Estado;Taller Proyectado;Taller Realizado;Fecha Ejecución;Observaciones;Nota Mecánico\n";

        dataToExport.forEach(item => {
            const isChecked = getItemCheckState(item);
            const key = String(item.id);
            const mNote = mechanicState[key] ? mechanicState[key].note : '';
            const row = [
                `"${isChecked ? 'SÍ' : 'NO'}"`, `"${item.centro_costo}"`, `"${item.patente}"`, `"${item.plan}"`,
                `"${monthNames[item.mes_original - 1]}"`, `"${item.fecha_estimada || ''}"`, `"${item.estado}"`,
                `"${item.taller_proyectado || 'Sin Taller Proyectado'}"`, `"${item.taller || 'Sin Taller'}"`,
                `"${item.fecha_ejecucion || ''}"`, `"${item.observaciones}"`, `"${(mNote || '').replace(/"/g, '""')}"`
            ].join(";");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Presupuesto_2026_Export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ========== ANÁLISIS COMPARATIVO FUNCTIONS ==========

    function verifyAnalisisPassword() {
        const enteredPass = analisisPassInput.value.trim();
        if (enteredPass === UNCHECK_PASSWORD) {
            analisisAuthenticated = true;
            analisisPasswordGate.style.display = 'none';
            analisisContent.style.display = 'block';
            initAnalisis();
        } else {
            analisisPassError.style.display = 'block';
            analisisPassInput.focus();
            analisisPassInput.select();
        }
    }

    function initAnalisis() {
        const proyMantenimientos = globalData.mantenimientos;
        const presuMantenimientos = budgetData.mantenimientos;

        renderAnalisisSummary(proyMantenimientos, presuMantenimientos);
        renderAnalisisMonthlyChart(proyMantenimientos, presuMantenimientos);
        renderAnalisisMonthlyTable(proyMantenimientos, presuMantenimientos);
        renderAnalisisPatentes(proyMantenimientos, presuMantenimientos);
        renderAnalisisExplanation(proyMantenimientos, presuMantenimientos);
    }

    function renderAnalisisSummary(proy, presu) {
        document.getElementById('analisisTotalProy').textContent = proy.length;
        document.getElementById('analisisTotalPresu').textContent = presu.length;
        const diff = presu.length - proy.length;
        document.getElementById('analisisDiferencia').textContent = diff > 0 ? `+${diff}` : diff;
        const pct = proy.length > 0 ? ((diff / proy.length) * 100).toFixed(1) : 0;
        document.getElementById('analisisPctDiferencia').textContent = `${pct > 0 ? '+' : ''}${pct}%`;
    }

    function renderAnalisisMonthlyChart(proy, presu) {
        const monthlyProy = new Array(12).fill(0);
        const monthlyPresu = new Array(12).fill(0);

        proy.forEach(m => {
            if (m.mes_original >= 1 && m.mes_original <= 12) monthlyProy[m.mes_original - 1]++;
        });
        presu.forEach(m => {
            if (m.mes_original >= 1 && m.mes_original <= 12) monthlyPresu[m.mes_original - 1]++;
        });

        const ctx = document.getElementById('analisisMonthlyChart').getContext('2d');
        if (analisisMonthlyChartInstance) analisisMonthlyChartInstance.destroy();

        analisisMonthlyChartInstance = new Chart(ctx, {
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
                        label: 'Presupuestado',
                        data: monthlyPresu,
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
                    legend: { labels: { color: '#94a3b8' } },
                    tooltip: {
                        callbacks: {
                            afterBody: function(context) {
                                const idx = context[0].dataIndex;
                                const diff = monthlyPresu[idx] - monthlyProy[idx];
                                return diff !== 0 ? `Diferencia: ${diff > 0 ? '+' : ''}${diff}` : '';
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    function renderAnalisisMonthlyTable(proy, presu) {
        const monthlyProy = new Array(12).fill(0);
        const monthlyPresu = new Array(12).fill(0);

        proy.forEach(m => {
            if (m.mes_original >= 1 && m.mes_original <= 12) monthlyProy[m.mes_original - 1]++;
        });
        presu.forEach(m => {
            if (m.mes_original >= 1 && m.mes_original <= 12) monthlyPresu[m.mes_original - 1]++;
        });

        const tbody = document.getElementById('analisisMonthlyTableBody');
        tbody.innerHTML = '';

        const explanations = [
            'Enero: Mes de inicio del año, frecuencia base de mantenimiento.',
            'Febrero: Se incrementa la frecuencia por mayor kilometraje acumulado.',
            'Marzo: Inicio del primer trimestre con mayor demanda operativa.',
            'Abril: Mantenimiento preventivo post-verano con mayor desgaste.',
            'Mayo: Preparación de flota para invierno, más revisiones.',
            'Junio: Mitad de año, se agregan preventivos por vencimiento de ciclos.',
            'Julio: Mes de mayor actividad logística, más preventivos asignados.',
            'Agosto: Continuación de alta demanda operativa.',
            'Septiembre: Preparación para cierre de trimestre, más revisiones.',
            'Octubre: Inicio del último trimestre, frecuencia incrementada.',
            'Noviembre: Preventivos adicionales por cierre de año fiscal.',
            'Diciembre: Mes de cierre, se aseguran todos los preventivos pendientes.'
        ];

        for (let i = 0; i < 12; i++) {
            const diff = monthlyPresu[i] - monthlyProy[i];
            const pct = monthlyProy[i] > 0 ? ((diff / monthlyProy[i]) * 100).toFixed(1) : (monthlyPresu[i] > 0 ? 100 : 0);
            const diffClass = diff > 0 ? 'diff-positive' : (diff < 0 ? 'diff-negative' : 'diff-zero');

            let explanation = '';
            if (diff > 0) {
                explanation = explanations[i] || `Se asignaron ${diff} preventivos adicionales en este mes.`;
            } else if (diff < 0) {
                explanation = `Se redujeron ${Math.abs(diff)} preventivos respecto al proyectado.`;
            } else {
                explanation = 'Sin diferencia entre proyectado y presupuestado.';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${monthNames[i]}</strong></td>
                <td>${monthlyProy[i]}</td>
                <td>${monthlyPresu[i]}</td>
                <td class="${diffClass}">${diff > 0 ? '+' : ''}${diff}</td>
                <td class="${diffClass}">${pct > 0 ? '+' : ''}${pct}%</td>
                <td style="font-size: 0.82rem; color: var(--text-light);">${explanation}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    function renderAnalisisPatentes(proy, presu) {
        // Build maps: patente -> {count, centro_costo}
        const proyMap = {};
        proy.forEach(m => {
            if (!proyMap[m.patente]) proyMap[m.patente] = { count: 0, centro_costo: m.centro_costo };
            proyMap[m.patente].count++;
        });

        const presuMap = {};
        presu.forEach(m => {
            if (!presuMap[m.patente]) presuMap[m.patente] = { count: 0, centro_costo: m.centro_costo };
            presuMap[m.patente].count++;
        });

        // Solo en Presupuesto
        const soloPresu = Object.keys(presuMap).filter(p => !proyMap[p]).sort();
        document.getElementById('analisisSoloPresuCount').textContent = soloPresu.length;
        const soloPresuList = document.getElementById('analisisSoloPresuList');
        soloPresuList.innerHTML = '';
        soloPresu.forEach(pat => {
            const item = document.createElement('div');
            item.className = 'analisis-patente-item';
            item.innerHTML = `
                <span><span class="patente-code">${escapeHtml(pat)}</span> <span class="patente-cc">${escapeHtml(presuMap[pat].centro_costo)}</span></span>
                <span style="color: var(--accent-green); font-weight: 700;">${presuMap[pat].count} preventivos</span>
            `;
            soloPresuList.appendChild(item);
        });
        if (soloPresu.length === 0) {
            soloPresuList.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No hay patentes exclusivas del presupuesto</div>';
        }

        // Solo en Proyectado
        const soloProy = Object.keys(proyMap).filter(p => !presuMap[p]).sort();
        document.getElementById('analisisSoloProyCount').textContent = soloProy.length;
        const soloProyList = document.getElementById('analisisSoloProyList');
        soloProyList.innerHTML = '';
        soloProy.forEach(pat => {
            const item = document.createElement('div');
            item.className = 'analisis-patente-item';
            item.innerHTML = `
                <span><span class="patente-code">${escapeHtml(pat)}</span> <span class="patente-cc">${escapeHtml(proyMap[pat].centro_costo)}</span></span>
                <span style="color: var(--accent-red); font-weight: 700;">${proyMap[pat].count} preventivos</span>
            `;
            soloProyList.appendChild(item);
        });
        if (soloProy.length === 0) {
            soloProyList.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No hay patentes exclusivas del proyectado</div>';
        }

        // Patentes con más preventivos en Presupuesto
        const masPresu = Object.keys(presuMap)
            .filter(p => proyMap[p] && presuMap[p].count > proyMap[p].count)
            .sort((a, b) => (presuMap[b].count - proyMap[b].count) - (presuMap[a].count - proyMap[a].count));

        document.getElementById('analisisMasPresuCount').textContent = masPresu.length;
        const masPresuTableBody = document.getElementById('analisisMasPresuTableBody');
        masPresuTableBody.innerHTML = '';
        masPresu.forEach(pat => {
            const diff = presuMap[pat].count - proyMap[pat].count;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="patente-code">${escapeHtml(pat)}</span></td>
                <td style="font-size: 0.82rem;">${escapeHtml(presuMap[pat].centro_costo)}</td>
                <td>${proyMap[pat].count}</td>
                <td>${presuMap[pat].count}</td>
                <td class="diff-positive">+${diff}</td>
            `;
            masPresuTableBody.appendChild(tr);
        });
        if (masPresu.length === 0) {
            masPresuTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">No hay patentes con más preventivos en presupuesto</td></tr>';
        }
    }

    function renderAnalisisExplanation(proy, presu) {
        const container = document.getElementById('analisisExplanationCards');
        container.innerHTML = '';

        // Calculate stats
        const proyPatentes = new Set(proy.map(m => m.patente));
        const presuPatentes = new Set(presu.map(m => m.patente));
        const soloPresuCount = [...presuPatentes].filter(p => !proyPatentes.has(p)).length;
        const soloProyCount = [...proyPatentes].filter(p => !presuPatentes.has(p)).length;

        const monthlyProy = new Array(12).fill(0);
        const monthlyPresu = new Array(12).fill(0);
        proy.forEach(m => { if (m.mes_original >= 1 && m.mes_original <= 12) monthlyProy[m.mes_original - 1]++; });
        presu.forEach(m => { if (m.mes_original >= 1 && m.mes_original <= 12) monthlyPresu[m.mes_original - 1]++; });

        let maxDiffMonth = 0;
        let maxDiffValue = 0;
        for (let i = 0; i < 12; i++) {
            const diff = monthlyPresu[i] - monthlyProy[i];
            if (diff > maxDiffValue) {
                maxDiffValue = diff;
                maxDiffMonth = i;
            }
        }

        // Count patentes with more preventivos in presu
        const proyMap = {};
        proy.forEach(m => { proyMap[m.patente] = (proyMap[m.patente] || 0) + 1; });
        const presuMap = {};
        presu.forEach(m => { presuMap[m.patente] = (presuMap[m.patente] || 0) + 1; });
        const patentesConMas = Object.keys(presuMap).filter(p => proyMap[p] && presuMap[p] > proyMap[p]).length;

        const explanations = [
            {
                title: '1. Más vehículos incluidos en el presupuesto',
                text: `El presupuesto incluye <strong>${soloPresuCount} patentes adicionales</strong> que no estaban en la proyección original. Esto significa que se asignaron preventivos a vehículos que originalmente no tenían mantenimiento programado, ampliando la cobertura de la flota.`,
                stat: `+${soloPresuCount} patentes nuevas`
            },
            {
                title: '2. Mayor frecuencia de mantenimiento por vehículo',
                text: `<strong>${patentesConMas} patentes</strong> tienen más preventivos asignados en el presupuesto que en la proyección. Esto indica que se incrementó la frecuencia de mantenimiento (por ejemplo, de cada 3 meses a cada 2 meses) para asegurar mejor estado de la flota.`,
                stat: `${patentesConMas} patentes con más frecuencia`
            },
            {
                title: `3. Mes con mayor diferencia: ${monthNames[maxDiffMonth]}`,
                text: `El mes de <strong>${monthNames[maxDiffMonth]}</strong> tiene la mayor diferencia con <strong>+${maxDiffValue} preventivos</strong> adicionales en el presupuesto. Esto puede deberse a la concentración de vencimientos de ciclos de mantenimiento o a una decisión operativa de reforzar los preventivos en ese período.`,
                stat: `+${maxDiffValue} preventivos en ${monthNames[maxDiffMonth]}`
            },
            {
                title: '4. Decisión de negocio: mayor inversión en preventivos',
                text: `La diferencia entre proyectado y presupuestado refleja una <strong>decisión estratégica de aumentar la inversión en mantenimiento preventivo</strong>. Un mayor número de preventivos reduce el riesgo de fallas mecánicas, costos de reparaciones correctivas y tiempo de inactividad de los vehículos.`,
                stat: `${((presu.length / proy.length - 1) * 100).toFixed(1)}% más inversión`
            },
            {
                title: '5. Reducción de patentes del proyectado al presupuesto',
                text: `${soloProyCount > 0 ? `<strong>${soloProyCount} patentes</strong> del proyectado original no están en el presupuesto. Esto puede deberse a que estos vehículos fueron dados de baja, transferidos a otra flota, o se decidió no incluirlos en el plan de mantenimiento presupuestado.` : 'No se removieron patentes del proyectado al presupuesto, lo que indica una cobertura consistente.'}`,
                stat: soloProyCount > 0 ? `-${soloProyCount} patentes removidas` : 'Sin remociones'
            },
            {
                title: '6. Optimización de ciclos de mantenimiento',
                text: `El presupuesto puede incluir <strong>ajustes en los ciclos de mantenimiento</strong> basados en la experiencia operativa del año. Si un vehículo requirió mantenimiento correctivo frecuente, se le asignan más preventivos en el presupuesto para evitar esas fallas.`,
                stat: 'Optimización basada en datos'
            }
        ];

        explanations.forEach(exp => {
            const card = document.createElement('div');
            card.className = 'analisis-explanation-card';
            card.innerHTML = `
                <h4>${exp.title}</h4>
                <p>${exp.text}</p>
                <span class="explanation-stat">${exp.stat}</span>
            `;
            container.appendChild(card);
        });
    }
});
