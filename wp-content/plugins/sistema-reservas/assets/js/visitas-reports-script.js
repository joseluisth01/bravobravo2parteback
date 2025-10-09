/**
 * Script para gestión de informes de visitas guiadas
 * Archivo: wp-content/plugins/sistema-reservas/assets/js/visitas-reports-script.js
 */

let currentVisitasPage = 1;
let currentVisitasFilters = {
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    tipo_fecha: 'servicio',
    estado_filtro: 'confirmadas',
    agency_filter: 'todas'
};

/**
 * Cargar sección de informes de visitas
 */
function loadVisitasReportsSection() {
    console.log('=== CARGANDO SECCIÓN DE INFORMES DE VISITAS ===');

    const content = `
        <div class="visitas-reports-container">
            <h2>📊 Informes de Visitas Guiadas</h2>
            
            <!-- Filtros -->
            <div class="filters-section">
                <div class="filter-row">
                    <div class="filter-group">
                        <label>Fecha Inicio:</label>
                        <input type="date" id="visitas-fecha-inicio" value="${currentVisitasFilters.fecha_inicio}">
                    </div>
                    <div class="filter-group">
                        <label>Fecha Fin:</label>
                        <input type="date" id="visitas-fecha-fin" value="${currentVisitasFilters.fecha_fin}">
                    </div>
                    <div class="filter-group">
                        <label>Tipo de Fecha:</label>
                        <select id="visitas-tipo-fecha">
                            <option value="servicio">Fecha de Servicio</option>
                            <option value="compra">Fecha de Compra</option>
                        </select>
                    </div>
                </div>
                <div class="filter-row">
                    <div class="filter-group">
                        <label>Estado:</label>
                        <select id="visitas-estado-filtro">
                            <option value="confirmadas">Confirmadas</option>
                            <option value="canceladas">Canceladas</option>
                            <option value="todas">Todas</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Agencia:</label>
                        <select id="visitas-agency-filter">
                            <option value="todas">Todas las agencias</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <button class="btn-primary" onclick="applyVisitasFilters()">🔍 Filtrar</button>
                        <button class="btn-secondary" onclick="resetVisitasFilters()">↺ Reset</button>
                    </div>
                </div>
            </div>

            <!-- Búsqueda rápida -->
            <div class="search-section">
                <h3>🔎 Búsqueda Rápida</h3>
                <div class="search-row">
                    <select id="visitas-search-type">
                        <option value="localizador">Localizador</option>
                        <option value="email">Email</option>
                        <option value="telefono">Teléfono</option>
                        <option value="nombre">Nombre</option>
                        <option value="fecha_servicio">Fecha Servicio</option>
                    </select>
                    <input type="text" id="visitas-search-value" placeholder="Buscar...">
                    <button class="btn-primary" onclick="searchVisitas()">Buscar</button>
                </div>
            </div>

            <!-- Estadísticas -->
            <div id="visitas-stats-container"></div>

            <!-- Lista de visitas -->
            <div id="visitas-list-container"></div>

            <!-- Paginación -->
            <div id="visitas-pagination-container"></div>
        </div>
    `;

    document.getElementById('dashboard-content').innerHTML = content;

    // Cargar agencias para el filtro
    loadAgenciesForVisitasFilter();

    // Cargar datos iniciales
    loadVisitasReport();
}

/**
 * Cargar agencias para el filtro
 */
function loadAgenciesForVisitasFilter() {
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_agencies_for_filter',
            nonce: reservasAjax.nonce
        },
        success: function(response) {
            if (response.success && response.data) {
                const select = document.getElementById('visitas-agency-filter');
                response.data.forEach(agency => {
                    const option = document.createElement('option');
                    option.value = agency.id;
                    option.textContent = agency.agency_name;
                    select.appendChild(option);
                });
            }
        }
    });
}

/**
 * Cargar informe de visitas
 */
function loadVisitasReport() {
    console.log('=== CARGANDO INFORME DE VISITAS ===');
    
    showVisitasLoading();

    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_visitas_report',
            nonce: reservasAjax.nonce,
            ...currentVisitasFilters,
            page: currentVisitasPage
        },
        success: function(response) {
            console.log('Respuesta del servidor:', response);

            if (response.success) {
                renderVisitasStats(response.data.stats, response.data.stats_por_agencias);
                renderVisitasList(response.data.visitas);
                renderVisitasPagination(response.data.pagination);
            } else {
                showError('Error cargando informe: ' + response.data);
            }
        },
        error: function(xhr, status, error) {
            console.error('Error AJAX:', error);
            showError('Error de conexión al cargar el informe');
        }
    });
}

/**
 * Renderizar estadísticas
 */
function renderVisitasStats(stats, stats_agencias) {
    const container = document.getElementById('visitas-stats-container');
    
    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Visitas</h3>
                <div class="stat-number">${stats.total_visitas || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Total Personas</h3>
                <div class="stat-number">${stats.total_personas || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Adultos</h3>
                <div class="stat-number">${stats.total_adultos || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Niños</h3>
                <div class="stat-number">${stats.total_ninos || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Ingresos Totales</h3>
                <div class="stat-number">${parseFloat(stats.ingresos_totales || 0).toFixed(2)}€</div>
            </div>
        </div>
    `;

    // Estadísticas por agencia
    if (stats_agencias && stats_agencias.length > 0) {
        html += `
            <div class="agencies-stats-section">
                <h3>📊 Estadísticas por Agencia</h3>
                <table class="agencies-stats-table">
                    <thead>
                        <tr>
                            <th>Agencia</th>
                            <th>Visitas</th>
                            <th>Personas</th>
                            <th>Ingresos</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        stats_agencias.forEach(agency => {
            html += `
                <tr>
                    <td>${agency.agency_name}</td>
                    <td>${agency.total_visitas}</td>
                    <td>${agency.total_personas}</td>
                    <td>${parseFloat(agency.ingresos_total).toFixed(2)}€</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Renderizar lista de visitas
 */
function renderVisitasList(visitas) {
    const container = document.getElementById('visitas-list-container');
    
    if (!visitas || visitas.length === 0) {
        container.innerHTML = '<p class="no-results">No se encontraron visitas para los filtros seleccionados</p>';
        return;
    }

    let html = `
        <h3>Listado de Visitas (${visitas.length})</h3>
        <table class="visitas-table">
            <thead>
                <tr>
                    <th>Localizador</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Personas</th>
                    <th>Total</th>
                    <th>Agencia</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    visitas.forEach(visita => {
        const fecha = new Date(visita.fecha + 'T00:00:00').toLocaleDateString('es-ES');
        const estadoClass = visita.estado === 'confirmada' ? 'status-confirmed' : 'status-cancelled';
        
        html += `
            <tr>
                <td><strong>${visita.localizador}</strong></td>
                <td>${fecha}</td>
                <td>${visita.hora}</td>
                <td>${visita.nombre} ${visita.apellidos}</td>
                <td>${visita.total_personas}</td>
                <td>${parseFloat(visita.precio_total).toFixed(2)}€</td>
                <td>${visita.agency_name || 'Sin agencia'}</td>
                <td><span class="status-badge ${estadoClass}">${visita.estado}</span></td>
                <td>
                    <button class="btn-small" onclick="viewVisitaDetails(${visita.id})">Ver</button>
                    ${visita.estado === 'confirmada' ? `<button class="btn-small btn-danger" onclick="cancelVisita(${visita.id})">Cancelar</button>` : ''}
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

/**
 * Renderizar paginación
 */
function renderVisitasPagination(pagination) {
    const container = document.getElementById('visitas-pagination-container');
    
    if (pagination.total_pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';
    
    // Botón anterior
    if (pagination.current_page > 1) {
        html += `<button onclick="changeVisitasPage(${pagination.current_page - 1})">« Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= pagination.total_pages; i++) {
        const activeClass = i === pagination.current_page ? 'active' : '';
        html += `<button class="${activeClass}" onclick="changeVisitasPage(${i})">${i}</button>`;
    }

    // Botón siguiente
    if (pagination.current_page < pagination.total_pages) {
        html += `<button onclick="changeVisitasPage(${pagination.current_page + 1})">Siguiente »</button>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Aplicar filtros
 */
function applyVisitasFilters() {
    currentVisitasFilters = {
        fecha_inicio: document.getElementById('visitas-fecha-inicio').value,
        fecha_fin: document.getElementById('visitas-fecha-fin').value,
        tipo_fecha: document.getElementById('visitas-tipo-fecha').value,
        estado_filtro: document.getElementById('visitas-estado-filtro').value,
        agency_filter: document.getElementById('visitas-agency-filter').value
    };
    currentVisitasPage = 1;
    loadVisitasReport();
}

/**
 * Resetear filtros
 */
function resetVisitasFilters() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('visitas-fecha-inicio').value = today;
    document.getElementById('visitas-fecha-fin').value = today;
    document.getElementById('visitas-tipo-fecha').value = 'servicio';
    document.getElementById('visitas-estado-filtro').value = 'confirmadas';
    document.getElementById('visitas-agency-filter').value = 'todas';
    applyVisitasFilters();
}

/**
 * Buscar visitas
 */
function searchVisitas() {
    const searchType = document.getElementById('visitas-search-type').value;
    const searchValue = document.getElementById('visitas-search-value').value;

    if (!searchValue) {
        alert('Por favor, introduce un valor de búsqueda');
        return;
    }

    showVisitasLoading();

    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'search_visitas',
            nonce: reservasAjax.nonce,
            search_type: searchType,
            search_value: searchValue
        },
        success: function(response) {
            if (response.success) {
                document.getElementById('visitas-stats-container').innerHTML = `<p>Resultados de búsqueda: ${response.data.total_found} visitas encontradas</p>`;
                renderVisitasList(response.data.visitas);
                document.getElementById('visitas-pagination-container').innerHTML = '';
            } else {
                showError('Error en la búsqueda: ' + response.data);
            }
        }
    });
}

/**
 * Ver detalles de visita
 */
function viewVisitaDetails(visitaId) {
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_visita_details',
            nonce: reservasAjax.nonce,
            visita_id: visitaId
        },
        success: function(response) {
            if (response.success) {
                showVisitaDetailsModal(response.data);
            }
        }
    });
}

/**
 * Mostrar modal de detalles
 */
function showVisitaDetailsModal(visita) {
    const fecha = new Date(visita.fecha + 'T00:00:00').toLocaleDateString('es-ES');
    
    const modalHtml = `
        <div class="modal-overlay" onclick="closeVisitaDetailsModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <span class="close" onclick="closeVisitaDetailsModal()">&times;</span>
                <h2>Detalles de Visita</h2>
                
                <div class="details-grid">
                    <div class="detail-item">
                        <strong>Localizador:</strong> ${visita.localizador}
                    </div>
                    <div class="detail-item">
                        <strong>Fecha:</strong> ${fecha}
                    </div>
                    <div class="detail-item">
                        <strong>Hora:</strong> ${visita.hora}
                    </div>
                    <div class="detail-item">
                        <strong>Cliente:</strong> ${visita.nombre} ${visita.apellidos}
                    </div>
                    <div class="detail-item">
                        <strong>Email:</strong> ${visita.email}
                    </div>
                    <div class="detail-item">
                        <strong>Teléfono:</strong> ${visita.telefono}
                    </div>
                    <div class="detail-item">
                        <strong>Adultos:</strong> ${visita.adul