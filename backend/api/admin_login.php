<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';

    $valid_emails = ['admin@ngo.org', 'admin@surakshasetu.org'];

    // Check if the email is valid
    if (!in_array($email, $valid_emails)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email address not found.']);
        exit;
    }

    // Check if the password is correct
    if ($password !== ADMIN_PASSWORD) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect password.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Login successful']);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
}
?>
