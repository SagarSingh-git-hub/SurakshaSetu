<?php
require '../../config.php';

// Stats
$stats = [
    'total' => 0,
    'active' => 0,
    'this_month' => 0,
    'revoked' => 0
];

$res = $conn->query("SELECT 
    COUNT(*) as total, 
    SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status = 'Revoked' THEN 1 ELSE 0 END) as revoked,
    SUM(CASE WHEN MONTH(issue_date) = MONTH(CURRENT_DATE()) AND YEAR(issue_date) = YEAR(CURRENT_DATE()) THEN 1 ELSE 0 END) as this_month
    FROM certificates");
if ($row = $res->fetch_assoc()) {
    $stats['total'] = (int)$row['total'];
    $stats['active'] = (int)$row['active'];
    $stats['revoked'] = (int)$row['revoked'];
    $stats['this_month'] = (int)$row['this_month'];
}

// Fetch list
$search = isset($_GET['search']) ? $_GET['search'] : '';
$type = isset($_GET['type']) ? $_GET['type'] : 'All';
$status = isset($_GET['status']) ? $_GET['status'] : 'All';
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 10;
$offset = ($page - 1) * $limit;

$where = ["1=1"];
$params = [];
$types = "";

if ($search) {
    $where[] = "(c.recipient_name LIKE ? OR c.cert_id LIKE ? OR c.recipient_email LIKE ?)";
    $like_search = "%$search%";
    $params[] = &$like_search;
    $params[] = &$like_search;
    $params[] = &$like_search;
    $types .= "sss";
}
if ($type !== 'All' && $type !== 'All types') {
    $where[] = "c.certificate_type = ?";
    $params[] = &$type;
    $types .= "s";
}
if ($status !== 'All' && $status !== 'All status') {
    $where[] = "c.status = ?";
    $params[] = &$status;
    $types .= "s";
}

$where_clause = implode(" AND ", $where);
$query = "SELECT c.*, t.bg_gradient, t.primary_color, t.icon_class 
          FROM certificates c 
          LEFT JOIN certificate_templates t ON c.template_id = t.id 
          WHERE $where_clause 
          ORDER BY c.created_at DESC 
          LIMIT ? OFFSET ?";

$stmt = $conn->prepare($query);
$stmt_params = $params;
$stmt_types = $types . "ii";
$stmt_params[] = &$limit;
$stmt_params[] = &$offset;

if ($stmt_types) {
    array_unshift($stmt_params, $stmt_types);
    call_user_func_array([$stmt, 'bind_param'], $stmt_params);
}
$stmt->execute();
$result = $stmt->get_result();

$certs = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $certs[] = $row;
    }
}
$stmt->close();

$count_query = "SELECT COUNT(*) as count FROM certificates c WHERE $where_clause";
$count_stmt = $conn->prepare($count_query);
if ($types) {
    $count_params = $params;
    array_unshift($count_params, $types);
    call_user_func_array([$count_stmt, 'bind_param'], $count_params);
}
$count_stmt->execute();
$count_res = $count_stmt->get_result();
$total_filtered = $count_res->fetch_assoc()['count'];
$count_stmt->close();

if (isset($_GET['export']) && $_GET['export'] == '1') {
    // Export all filtered without limit
    $export_query = "SELECT c.cert_id, c.recipient_name, c.recipient_email, c.certificate_type, c.recipient_zone, c.issue_date, c.status 
                     FROM certificates c WHERE $where_clause ORDER BY c.created_at DESC";
    $export_stmt = $conn->prepare($export_query);
    if ($types) {
        $export_params = $params;
        array_unshift($export_params, $types);
        call_user_func_array([$export_stmt, 'bind_param'], $export_params);
    }
    $export_stmt->execute();
    $export_res = $export_stmt->get_result();
    
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=certificates_export.csv');
    $output = fopen('php://output', 'w');
    
    // Add UTF-8 BOM for proper Excel rendering
    fputs($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
    
    fputcsv($output, ['Cert ID', 'Recipient Name', 'Email', 'Type', 'Zone', 'Issue Date', 'Status']);
    
    if ($export_res) {
        while ($row = $export_res->fetch_assoc()) {
            fputcsv($output, $row);
        }
    }
    fclose($output);
    exit;
}

echo json_encode([
    'success' => true,
    'stats' => $stats,
    'data' => $certs,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => (int)$total_filtered,
        'total_pages' => ceil($total_filtered / $limit)
    ]
]);
?>
