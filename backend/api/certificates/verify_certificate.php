<?php
require '../../config.php';
global $conn;

if (!isset($_GET['id']) || !isset($_GET['hash'])) {
    echo json_encode(['success' => false, 'error' => 'Missing ID or Hash']);
    exit;
}

$cert_id = $conn->real_escape_string($_GET['id']);
$hash = $conn->real_escape_string($_GET['hash']);

$sql = "SELECT c.*, t.name as template_name 
        FROM certificates c 
        LEFT JOIN certificate_templates t ON c.template_id = t.id 
        WHERE c.cert_id = ? AND c.hash_sha256 = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("ss", $cert_id, $hash);
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
