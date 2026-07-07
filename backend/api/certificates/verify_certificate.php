<?php
require '../../config.php';
global $conn;

if (!isset($_GET['q']) || empty(trim($_GET['q']))) {
    echo json_encode(['success' => false, 'error' => 'Missing query parameter']);
    exit;
}

$query = $conn->real_escape_string(trim($_GET['q']));

$sql = "SELECT c.*, t.name as template_name 
        FROM certificates c 
        LEFT JOIN certificate_templates t ON c.template_id = t.id 
        WHERE c.cert_id = ? OR c.hash_sha256 = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("ss", $query, $query);
$stmt->execute();
$res = $stmt->get_result();

if ($res && $res->num_rows > 0) {
    $cert = $res->fetch_assoc();
    echo json_encode([
        'success' => true, 
        'valid' => true,
        'data' => [
            'cert_id' => $cert['cert_id'],
            'recipient_name' => $cert['recipient_name'],
            'certificate_type' => $cert['certificate_type'],
            'issue_date' => $cert['issue_date'],
            'issuing_authority' => $cert['issuing_authority'],
            'status' => $cert['status']
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'valid' => false, 'error' => 'Certificate not found or tampered.']);
}
?>
