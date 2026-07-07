<?php
require '../../config.php';
require_once __DIR__ . '/../log_activity.php';
global $conn;

$raw_input = file_get_contents("php://input");
if (empty($raw_input) && php_sapi_name() === 'cli') {
    $raw_input = file_get_contents("php://stdin");
}
$data = json_decode($raw_input, true);
if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Invalid data', 'raw_input' => $raw_input]);
    exit;
}

$recipient_name = $data['recipient_name'] ?? '';
$recipient_email = $data['recipient_email'] ?? '';
$recipient_phone = $data['recipient_phone'] ?? '';
$recipient_zone = $data['recipient_zone'] ?? '';
$certificate_type = $data['certificate_type'] ?? '';

// Validations
if (!preg_match('/^[A-Za-z\s]+$/', $recipient_name)) {
    echo json_encode(['success' => false, 'error' => 'Full name must contain only alphabets and spaces.']);
    exit;
}
$numericPhone = str_replace('+91', '', $recipient_phone);
if (!empty($numericPhone) && !preg_match('/^\d{10}$/', $numericPhone)) {
    echo json_encode(['success' => false, 'error' => 'Phone number must be exactly 10 digits.']);
    exit;
}

$recipient_name = $conn->real_escape_string($recipient_name);
$recipient_email = $conn->real_escape_string($recipient_email);
$recipient_phone = $conn->real_escape_string($recipient_phone);
$recipient_zone = $conn->real_escape_string($recipient_zone);
$certificate_type = $conn->real_escape_string($certificate_type);
$issue_date = $conn->real_escape_string($data['issue_date']);
$citation = $conn->real_escape_string($data['citation']);
$issuing_authority = $conn->real_escape_string($data['issuing_authority']);
$co_signatory = $conn->real_escape_string($data['co_signatory'] ?? '');
$template_id = (int)($data['template_id'] ?? 0);
$prefix = 'SS-CERT';
$recipient_type = $conn->real_escape_string($data['recipient_type'] ?? 'Community Member');

// Generate unique ID
$year = date('Y', strtotime($issue_date));
$query = "SELECT COUNT(*) as cnt FROM certificates WHERE cert_id LIKE '$prefix-$year-%'";
$res = $conn->query($query);
$row = $res->fetch_assoc();
$seq = str_pad($row['cnt'] + 1, 4, '0', STR_PAD_LEFT);
$cert_id = "$prefix-$year-$seq";

// Generate Digital Signature / Hash
$secret_key = 'SURAKSHA_SETU_SECRET_2026';
$data_to_hash = $cert_id . $recipient_name . $issue_date . $certificate_type . $secret_key;
$hash_sha256 = hash('sha256', $data_to_hash);

// Generate QR Code URL (Verification URL)
$verify_url = "https://surakshasetu.org/verify?id=" . urlencode($cert_id) . "&hash=" . $hash_sha256;
$qr_code_url = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" . urlencode($verify_url);

// Ensure recipient_type column exists
$conn->query("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'Community Member'");

$sql = "INSERT INTO certificates (cert_id, recipient_name, recipient_email, recipient_phone, recipient_zone, certificate_type, issue_date, citation, issuing_authority, co_signatory, template_id, recipient_type, hash_sha256, qr_code_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sql);
$template_id_val = $template_id > 0 ? $template_id : null;
$stmt->bind_param("ssssssssssisss", $cert_id, $recipient_name, $recipient_email, $recipient_phone, $recipient_zone, $certificate_type, $issue_date, $citation, $issuing_authority, $co_signatory, $template_id_val, $recipient_type, $hash_sha256, $qr_code_url);

if ($stmt->execute()) {
    // Update template usage
    if ($template_id > 0) {
        $conn->query("UPDATE certificate_templates SET usage_count = usage_count + 1, last_used = NOW() WHERE id = $template_id");
    }

    // Trigger Pusher event for Community Feed / Realtime updates
    if (!empty($data['publish_to_feed'])) {
        triggerPusherEvent('community-feed', 'new-certificate', [
            'cert_id' => $cert_id,
            'recipient' => $recipient_name,
            'type' => $certificate_type,
            'citation' => $citation
        ]);
    }
    
    // Email Delivery logic
    if (!empty($data['send_email']) && !empty($recipient_email)) {
        $subject = "Your Certificate of $certificate_type is Ready!";
        $message = "<html><body style='font-family:sans-serif; padding:20px;'>
                    <h2 style='color:#16a34a;'>Congratulations $recipient_name!</h2>
                    <p>You have been awarded a <strong>$certificate_type</strong>.</p>
                    <p>Your Certificate ID is: <strong>$cert_id</strong></p>
                    <p>You can view and download your official certificate by logging into the Suraksha Setu portal.</p>
                    <hr style='border:none; border-top:1px solid #eee;'/>
                    <p style='font-size:12px; color:#666;'>This is an automated message. Please do not reply.</p>
                    </body></html>";
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: no-reply@surakshasetu.org" . "\r\n";
        // Prevent mail() from hanging on servers without an MTA
        // @mail($recipient_email, $subject, $message, $headers);
    }
    
    logActivity($conn, 'Certificate Issued', $cert_id, "Certificate #$cert_id issued to $recipient_name for $certificate_type", 'Certificate', $recipient_zone);

    echo json_encode(['success' => true, 'cert_id' => $cert_id]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}
?>
