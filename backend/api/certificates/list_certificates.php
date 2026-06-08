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
$search = isset($_GET['search']) ? $conn->real_escape_string($_GET['search']) : '';
$type = isset($_GET['type']) ? $conn->real_escape_string($_GET['type']) : 'All';
$status = isset($_GET['status']) ? $conn->real_escape_string($_GET['status']) : 'All';
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 10;
$offset = ($page - 1) * $limit;

$where = ["1=1"];
if ($search) {
    $where[] = "(recipient_name LIKE '%$search%' OR cert_id LIKE '%$search%' OR recipient_email LIKE '%$search%')";
}
if ($type !== 'All' && $type !== 'All types') {
    $where[] = "certificate_type = '$type'";
}
if ($status !== 'All' && $status !== 'All status') {
    $where[] = "status = '$status'";
}

$where_clause = implode(" AND ", $where);
$query = "SELECT c.*, t.bg_gradient, t.primary_color, t.icon_class 
          FROM certificates c 
          LEFT JOIN certificate_templates t ON c.template_id = t.id 
          WHERE $where_clause 
          ORDER BY c.created_at DESC 
          LIMIT $limit OFFSET $offset";

$result = $conn->query($query);
$certs = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $certs[] = $row;
    }
}

$count_res = $conn->query("SELECT COUNT(*) as count FROM certificates WHERE $where_clause");
$total_filtered = $count_res->fetch_assoc()['count'];

if (isset($_GET['export']) && $_GET['export'] == '1') {
    // Export all filtered without limit
    $export_query = "SELECT c.cert_id, c.recipient_name, c.recipient_email, c.certificate_type, c.recipient_zone, c.issue_date, c.status 
                     FROM certificates c WHERE $where_clause ORDER BY c.created_at DESC";
    $export_res = $conn->query($export_query);
    
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=certificates_export.csv');
    $output = fopen('php://output', 'w');
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
