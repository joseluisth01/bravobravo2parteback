<?php

/**
 * Clase para gestionar los informes de visitas guiadas
 * Archivo: wp-content/plugins/sistema-reservas/includes/class-visitas-reports-admin.php
 */
class ReservasVisitasReportsAdmin
{
    public function __construct()
    {
        // Hooks AJAX para informes de visitas
        add_action('wp_ajax_get_visitas_report', array($this, 'get_visitas_report'));
        add_action('wp_ajax_nopriv_get_visitas_report', array($this, 'get_visitas_report'));

        add_action('wp_ajax_search_visitas', array($this, 'search_visitas'));
        add_action('wp_ajax_nopriv_search_visitas', array($this, 'search_visitas'));

        add_action('wp_ajax_get_visita_details', array($this, 'get_visita_details'));
        add_action('wp_ajax_nopriv_get_visita_details', array($this, 'get_visita_details'));

        add_action('wp_ajax_cancel_visita', array($this, 'cancel_visita'));
        add_action('wp_ajax_nopriv_cancel_visita', array($this, 'cancel_visita'));
    }

    /**
     * Obtener informe de visitas por fechas
     */
    public function get_visitas_report()
    {
        error_log('=== VISITAS REPORTS AJAX REQUEST START ===');
        header('Content-Type: application/json');

        try {
            if (!session_id()) {
                session_start();
            }

            if (!isset($_SESSION['reservas_user'])) {
                wp_send_json_error('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
                return;
            }

            $user = $_SESSION['reservas_user'];
            if (!in_array($user['role'], ['super_admin', 'admin'])) {
                wp_send_json_error('Sin permisos');
                return;
            }

            global $wpdb;
            $table_visitas = $wpdb->prefix . 'reservas_visitas';
            $table_agencies = $wpdb->prefix . 'reservas_agencies';

            // Parámetros de filtro
            $fecha_inicio = sanitize_text_field($_POST['fecha_inicio'] ?? date('Y-m-d'));
            $fecha_fin = sanitize_text_field($_POST['fecha_fin'] ?? date('Y-m-d'));
            $tipo_fecha = sanitize_text_field($_POST['tipo_fecha'] ?? 'servicio');
            $estado_filtro = sanitize_text_field($_POST['estado_filtro'] ?? 'confirmadas');
            $agency_filter = sanitize_text_field($_POST['agency_filter'] ?? 'todas');

            $page = intval($_POST['page'] ?? 1);
            $per_page = 20;
            $offset = ($page - 1) * $per_page;

            // Construir condiciones WHERE
            $where_conditions = array();
            $query_params = array();

            // Filtro por tipo de fecha
            if ($tipo_fecha === 'compra') {
                $where_conditions[] = "DATE(v.created_at) BETWEEN %s AND %s";
            } else {
                $where_conditions[] = "v.fecha BETWEEN %s AND %s";
            }
            $query_params[] = $fecha_inicio;
            $query_params[] = $fecha_fin;

            // Filtro de estado
            switch ($estado_filtro) {
                case 'confirmadas':
                    $where_conditions[] = "v.estado = 'confirmada'";
                    break;
                case 'canceladas':
                    $where_conditions[] = "v.estado = 'cancelada'";
                    break;
                case 'todas':
                    break;
            }

            // Filtro por agencias
            if ($agency_filter !== 'todas' && is_numeric($agency_filter)) {
                $where_conditions[] = "v.agency_id = %d";
                $query_params[] = intval($agency_filter);
            }

            $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);

            // Query principal
            $query = "SELECT v.*, a.agency_name, a.email as agency_email
                     FROM $table_visitas v
                     LEFT JOIN $table_agencies a ON v.agency_id = a.id
                     $where_clause
                     ORDER BY v.fecha DESC, v.hora DESC
                     LIMIT %d OFFSET %d";

            $query_params[] = $per_page;
            $query_params[] = $offset;

            $visitas = $wpdb->get_results($wpdb->prepare($query, ...$query_params));

            if ($wpdb->last_error) {
                error_log('❌ Database error: ' . $wpdb->last_error);
                wp_send_json_error('Database error: ' . $wpdb->last_error);
                return;
            }

            // Contar total
            $count_query = "SELECT COUNT(*) FROM $table_visitas v 
                           LEFT JOIN $table_agencies a ON v.agency_id = a.id
                           $where_clause";
            $count_params = array_slice($query_params, 0, -2);
            $total_visitas = $wpdb->get_var($wpdb->prepare($count_query, ...$count_params));

            // Estadísticas generales
            $stats = $wpdb->get_row($wpdb->prepare(
                "SELECT 
                    COUNT(*) as total_visitas,
                    SUM(v.adultos) as total_adultos,
                    SUM(v.ninos) as total_ninos,
                    SUM(v.ninos_menores) as total_ninos_menores,
                    SUM(v.total_personas) as total_personas,
                    SUM(v.precio_total) as ingresos_totales
                 FROM $table_visitas v
                 $where_clause",
                ...$count_params
            ));

            // Estadísticas por agencia
            $stats_por_agencias = null;
            if ($agency_filter === 'todas') {
                $stats_por_agencias = $wpdb->get_results($wpdb->prepare(
                    "SELECT 
                        v.agency_id,
                        COALESCE(a.agency_name, 'Sin Agencia') as agency_name,
                        COUNT(*) as total_visitas,
                        SUM(v.total_personas) as total_personas,
                        SUM(CASE WHEN v.estado = 'confirmada' THEN v.precio_total ELSE 0 END) as ingresos_total
                     FROM $table_visitas v
                     LEFT JOIN $table_agencies a ON v.agency_id = a.id
                     $where_clause
                     GROUP BY v.agency_id, a.agency_name
                     ORDER BY total_visitas DESC",
                    ...$count_params
                ));
            }

            $response_data = array(
                'visitas' => $visitas,
                'stats' => $stats,
                'stats_por_agencias' => $stats_por_agencias,
                'pagination' => array(
                    'current_page' => $page,
                    'total_pages' => ceil($total_visitas / $per_page),
                    'total_items' => $total_visitas,
                    'per_page' => $per_page
                ),
                'filtros' => array(
                    'fecha_inicio' => $fecha_inicio,
                    'fecha_fin' => $fecha_fin,
                    'tipo_fecha' => $tipo_fecha,
                    'estado_filtro' => $estado_filtro,
                    'agency_filter' => $agency_filter
                )
            );

            error_log('✅ Visitas reports data loaded successfully');
            wp_send_json_success($response_data);

        } catch (Exception $e) {
            error_log('❌ VISITAS REPORTS EXCEPTION: ' . $e->getMessage());
            wp_send_json_error('Server error: ' . $e->getMessage());
        }
    }

    /**
     * Buscar visitas por criterios
     */
    public function search_visitas()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_send_json_error('Sesión expirada');
            return;
        }

        $user = $_SESSION['reservas_user'];
        if (!in_array($user['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
            return;
        }

        global $wpdb;
        $table_visitas = $wpdb->prefix . 'reservas_visitas';

        $search_type = sanitize_text_field($_POST['search_type']);
        $search_value = sanitize_text_field($_POST['search_value']);

        $where_clause = '';
        $search_params = array();

        switch ($search_type) {
            case 'localizador':
                $where_clause = "WHERE v.localizador LIKE %s";
                $search_params[] = '%' . $search_value . '%';
                break;
            case 'email':
                $where_clause = "WHERE v.email LIKE %s";
                $search_params[] = '%' . $search_value . '%';
                break;
            case 'telefono':
                $where_clause = "WHERE v.telefono LIKE %s";
                $search_params[] = '%' . $search_value . '%';
                break;
            case 'fecha_servicio':
                $where_clause = "WHERE v.fecha = %s";
                $search_params[] = $search_value;
                break;
            case 'nombre':
                $where_clause = "WHERE (v.nombre LIKE %s OR v.apellidos LIKE %s)";
                $search_params[] = '%' . $search_value . '%';
                $search_params[] = '%' . $search_value . '%';
                break;
            default:
                wp_send_json_error('Tipo de búsqueda no válido');
        }

        $query = "SELECT v.*, a.agency_name
                  FROM $table_visitas v
                  LEFT JOIN {$wpdb->prefix}reservas_agencies a ON v.agency_id = a.id
                  $where_clause
                  ORDER BY v.created_at DESC
                  LIMIT 50";

        $visitas = $wpdb->get_results($wpdb->prepare($query, ...$search_params));

        wp_send_json_success(array(
            'visitas' => $visitas,
            'search_type' => $search_type,
            'search_value' => $search_value,
            'total_found' => count($visitas)
        ));
    }

    /**
     * Obtener detalles de una visita
     */
    public function get_visita_details()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_send_json_error('Sesión expirada');
            return;
        }

        $user = $_SESSION['reservas_user'];
        if (!in_array($user['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
            return;
        }

        global $wpdb;
        $table_visitas = $wpdb->prefix . 'reservas_visitas';

        $visita_id = intval($_POST['visita_id']);

        $visita = $wpdb->get_row($wpdb->prepare(
            "SELECT v.*, a.agency_name
             FROM $table_visitas v
             LEFT JOIN {$wpdb->prefix}reservas_agencies a ON v.agency_id = a.id
             WHERE v.id = %d",
            $visita_id
        ));

        if (!$visita) {
            wp_send_json_error('Visita no encontrada');
        }

        wp_send_json_success($visita);
    }

    /**
     * Cancelar visita
     */
    public function cancel_visita()
    {
        if (!wp_verify_nonce($_POST['nonce'], 'reservas_nonce')) {
            wp_send_json_error('Error de seguridad');
        }

        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user']) || !in_array($_SESSION['reservas_user']['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
        }

        global $wpdb;
        $table_visitas = $wpdb->prefix . 'reservas_visitas';

        $visita_id = intval($_POST['visita_id']);
        $motivo_cancelacion = sanitize_text_field($_POST['motivo_cancelacion'] ?? 'Cancelación administrativa');

        // Actualizar estado
        $result = $wpdb->update(
            $table_visitas,
            array(
                'estado' => 'cancelada',
                'updated_at' => current_time('mysql')
            ),
            array('id' => $visita_id)
        );

        if ($result !== false) {
            wp_send_json_success('Visita cancelada correctamente');
        } else {
            wp_send_json_error('Error cancelando la visita: ' . $wpdb->last_error);
        }
    }
}