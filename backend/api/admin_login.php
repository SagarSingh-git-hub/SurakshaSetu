<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';

    $allowed_emails = ['admin@ngo.org', 'admin@surakshasetu.org'];
    if (!in_array($email, $allowed_emails)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'This email is not registered as an administrator.']);
    } elseif ($password !== ADMIN_PASSWORD) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect password. Please try again.']);
    } else {
        echo json_encode(['success' => true, 'message' => 'Login successful']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
}
?>
