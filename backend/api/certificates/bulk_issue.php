<?php
require '../../config.php';
require_once __DIR__ . '/../log_activity.php';
global $conn;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'No valid CSV file uploaded']);
    exit;
}

$fileTmpPath = $_FILES['csv_file']['tmp_name'];
$fileName = $_FILES['csv_file']['name'];

$template_id = (int)($_POST['template_id'] ?? 0);
$certificate_type = $conn->real_escape_string($_POST['certificate_type'] ?? 'Bulk Certificate');
$issue_date = $conn->real_escape_string($_POST['issue_date'] ?? date('Y-m-d'));
$issuing_authority = $conn->real_escape_string($_POST['issuing_authority'] ?? 'Admin');
$co_signatory = $conn->real_escape_string($_POST['co_signatory'] ?? '');
$citation = $conn->real_escape_string($_POST['citation'] ?? '');

$results = ['success_count' => 0, 'error_count' => 0, 'errors' => []];
$prefix = 'SS-CERT';
$year = date('Y', strtotime($issue_date));
$secret_key = 'SURAKSHA_SETU_SECRET_2026';

if (($handle = fopen($fileTmpPath, "r")) !== FALSE) {
    $header = fgetcsv($handle, 1000, ",");
    
    // Ensure recipient_type column exists
    $conn->query("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'Community Member'");
    
    $sql = "INSERT INTO certificates (cert_id, recipient_name, recipient_email, recipient_phone, recipient_zone, certificate_type, issue_date, citation, issuing_authority, co_signatory, template_id, recipient_type, hash_sha256, qr_code_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    
    // Assuming CSV columns: Name, Email, Phone, Zone
    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
        if (count($data) < 2) continue; // Skip empty/invalid rows
        
        $recipient_name = $conn->real_escape_string(trim($data[0]));
        $recipient_email = $conn->real_escape_string(trim($data[1]));
        $recipient_phone = isset($data[2]) ? $conn->real_escape_string(trim($data[2])) : '';
        $recipient_zone = isset($data[3]) ? $conn->real_escape_string(trim($data[3])) : '';
        $recipient_type = 'Community Member';
        
        if (empty($recipient_name) || empty($recipient_email)) {
            $results['error_count']++;
            $results['errors'][] = "Row missing name or email.";
            continue;
        }

        // Generate unique ID
        $query = "SELECT COUNT(*) as cnt FROM certificates WHERE cert_id LIKE '$prefix-$year-%'";
        $res = $conn->query($query);
        $row = $res->fetch_assoc();
        $seq = str_pad($row['cnt'] + 1, 4, '0', STR_PAD_LEFT);
        $cert_id = "$prefix-$year-$seq";
        
        // Generate Hash and QR
        $data_to_hash = $cert_id . $recipient_name . $issue_date . $certificate_type . $secret_key;
        $hash_sha256 = hash('sha256', $data_to_hash);
        $verify_url = "https://surakshasetu.org/verify?id=" . urlencode($cert_id) . "&hash=" . $hash_sha256;
        $qr_code_url = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" . urlencode($verify_url);

        $template_id_val = $template_id > 0 ? $template_id : null;
        
        $stmt->bind_param("ssssssssssisss", $cert_id, $recipient_name, $recipient_email, $recipient_phone, $recipient_zone, $certificate_type, $issue_date, $citation, $issuing_authority, $co_signatory, $template_id_val, $recipient_type, $hash_sha256, $qr_code_url);
        
        if ($stmt->execute()) {
            $results['success_count']++;
            if ($template_id > 0) {
                $conn->query("UPDATE certificate_templates SET usage_count = usage_count + 1, last_used = NOW() WHERE id = $template_id");
            }
        } else {
            $results['error_count']++;
            $results['errors'][] = "Failed for $recipient_name: " . $conn->error;
        }
    }
    fclose($handle);
}

logActivity($conn, 'Bulk Certificates Issued', 'BULK', "{$results['success_count']} certificates issued in bulk", 'Certificate', 'System');

echo json_encode(['success' => true, 'results' => $results]);
?>
