<?php
require '../../config.php';

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

// Generate unique ID
$year = date('Y', strtotime($issue_date));
$query = "SELECT COUNT(*) as cnt FROM certificates WHERE cert_id LIKE '$prefix-$year-%'";
$res = $conn->query($query);
$row = $res->fetch_assoc();
$seq = str_pad($row['cnt'] + 1, 4, '0', STR_PAD_LEFT);
$cert_id = "$prefix-$year-$seq";

$sql = "INSERT INTO certificates (cert_id, recipient_name, recipient_email, recipient_phone, recipient_zone, certificate_type, issue_date, citation, issuing_authority, co_signatory, template_id) 
        VALUES ('$cert_id', '$recipient_name', '$recipient_email', '$recipient_phone', '$recipient_zone', '$certificate_type', '$issue_date', '$citation', '$issuing_authority', '$co_signatory', " . ($template_id > 0 ? $template_id : "NULL") . ")";

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

    echo json_encode(['success' => true, 'cert_id' => $cert_id]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}
?>
