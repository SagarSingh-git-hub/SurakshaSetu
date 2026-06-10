<?php
require '../../config.php';
global $conn;

if (!isset($_GET['id'])) {
    echo json_encode(['success' => false, 'error' => 'Missing certificate ID']);
    exit;
}

$cert_id = $conn->real_escape_string($_GET['id']);

$sql = "SELECT c.*, t.html_content, t.css_content 
        FROM certificates c 
        LEFT JOIN certificate_templates t ON c.template_id = t.id 
        WHERE c.cert_id = '$cert_id'";
$res = $conn->query($sql);

if ($res && $res->num_rows > 0) {
    $cert = $res->fetch_assoc();
    
    // If there's no HTML content, maybe it's not a template-based cert or template was deleted
    $html = $cert['html_content'] ?? '';
    if (!$html) {
        $html = '<div style="padding:40px; font-family:sans-serif; text-align:center;">
          <h1 style="color:#059669;">Certificate of Achievement</h1>
          <p>This is presented to</p>
          <h2 style="color:#1e293b;">{{NAME}}</h2>
          <p>For {{AWARD_TYPE}}</p>
        </div>';
    }

    // Replace variables
    $html = str_replace('{{NAME}}', htmlspecialchars($cert['recipient_name']), $html);
    $html = str_replace('{{EMAIL}}', htmlspecialchars($cert['recipient_email']), $html);
    $html = str_replace('{{ZONE}}', htmlspecialchars($cert['recipient_zone'] ?? ''), $html);
    $html = str_replace('{{DATE}}', htmlspecialchars($cert['issue_date']), $html);
    $html = str_replace('{{ISSUER}}', htmlspecialchars($cert['issuing_authority'] ?? ''), $html);
    $html = str_replace('{{CERTIFICATE_ID}}', htmlspecialchars($cert['cert_id']), $html);
    $html = str_replace('{{CERTIFICATE_TYPE}}', htmlspecialchars($cert['certificate_type']), $html);
    $html = str_replace('{{AWARD_TYPE}}', htmlspecialchars($cert['certificate_type'] ?? ''), $html);
    $html = str_replace('{{CITATION}}', htmlspecialchars($cert['citation'] ?? ''), $html);
    $html = str_replace('{{CO_SIGNATORY}}', htmlspecialchars($cert['co_signatory'] ?? ''), $html);
    
    // Also include CSS if any
    if (!empty($cert['css_content'])) {
        $html = '<style>' . $cert['css_content'] . '</style>' . $html;
    }

    echo json_encode(['success' => true, 'html_content' => $html]);
} else {
    echo json_encode(['success' => false, 'error' => 'Certificate not found']);
}
?>
