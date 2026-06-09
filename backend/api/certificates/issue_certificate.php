<?php
require '../../config.php';
require_once __DIR__ . '/../log_activity.php';
global $conn;

$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Invalid data']);
    exit;
}

$recipient_name = $conn->real_escape_string($data['recipient_name']);
$recipient_email = $conn->real_escape_string($data['recipient_email']);
$recipient_phone = $conn->real_escape_string($data['recipient_phone'] ?? '');
$recipient_zone = $conn->real_escape_string($data['recipient_zone'] ?? '');
$certificate_type = $conn->real_escape_string($data['certificate_type']);
$issue_date = $conn->real_escape_string($data['issue_date']);
$citation = $conn->real_escape_string($data['citation']);
$issuing_authority = $conn->real_escape_string($data['issuing_authority']);
$co_signatory = $conn->real_escape_string($data['co_signatory'] ?? '');
$template_id = (int)($data['template_id'] ?? 0);
$prefix = $conn->real_escape_string($data['prefix'] ?? 'SS-CERT');
$recipient_type = $conn->real_escape_string($data['recipient_type'] ?? 'Community Member');

// Generate unique ID
$year = date('Y', strtotime($issue_date));
$query = "SELECT COUNT(*) as cnt FROM certificates WHERE cert_id LIKE '$prefix-$year-%'";
$res = $conn->query($query);
$row = $res->fetch_assoc();
$seq = str_pad($row['cnt'] + 1, 4, '0', STR_PAD_LEFT);
$cert_id = "$prefix-$year-$seq";

// Ensure recipient_type column exists
$conn->query("ALTER TABLE certificates ADD COLUMN recipient_type VARCHAR(50) DEFAULT 'Community Member'");

$sql = "INSERT INTO certificates (cert_id, recipient_name, recipient_email, recipient_phone, recipient_zone, certificate_type, issue_date, citation, issuing_authority, co_signatory, template_id, recipient_type) 
        VALUES ('$cert_id', '$recipient_name', '$recipient_email', '$recipient_phone', '$recipient_zone', '$certificate_type', '$issue_date', '$citation', '$issuing_authority', '$co_signatory', " . ($template_id > 0 ? $template_id : "NULL") . ", '$recipient_type')";

if ($conn->query($sql)) {
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
        
        @mail($recipient_email, $subject, $message, $headers);
    }
    
    logActivity($conn, 'Certificate Issued', $cert_id, "Certificate #$cert_id issued to $recipient_name for $certificate_type", 'Certificate', $recipient_zone);

    echo json_encode(['success' => true, 'cert_id' => $cert_id]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}
?>
