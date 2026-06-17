<?php
require '../../config.php';

$data = json_decode(file_get_contents("php://input"), true);
if (!$data || empty($data['cert_id']) || empty($data['action'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid data']);
    exit;
}

$cert_id = $conn->real_escape_string($data['cert_id']);
$action = $data['action'];

$new_status = '';
if ($action === 'revoke') {
    $new_status = 'Revoked';
} elseif ($action === 'archive') {
    $new_status = 'Archived';
} elseif ($action === 'reactivate' || $action === 'reinstate') {
    $new_status = 'Active';
}

if ($new_status) {
    $stmt = $conn->prepare("UPDATE certificates SET status = ? WHERE cert_id = ?");
    $stmt->bind_param("ss", $new_status, $cert_id);
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    $stmt->close();
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
}
?>
