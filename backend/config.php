<?php
// Configuration File
$frontend_url = getenv('FRONTEND_URL') ?: '*';
if (getenv('APP_ENV') === 'development' && isset($_SERVER['HTTP_ORIGIN'])) {
    $frontend_url = $_SERVER['HTTP_ORIGIN']; // Auto-allow local origins for testing
}
header('Access-Control-Allow-Origin: ' . $frontend_url); // Restrict origins in production
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Error Reporting based on Environment
if (getenv('APP_ENV') === 'production') {
    error_reporting(0);
    ini_set('display_errors', '0');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
}

// Load .env variables manually (Simple custom loader)
$env_path = __DIR__ . '/.env';
if (file_exists($env_path)) {
    $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\""); // Remove whitespace and quotes
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// --- DATABASE CREDENTIALS ---
define('DB_HOST', getenv('DB_HOST') ?: (getenv('MYSQLHOST') ?: 'localhost'));
define('DB_USER', getenv('DB_USERNAME') ?: (getenv('DB_USER') ?: (getenv('MYSQLUSER') ?: 'root')));
define('DB_PASS', getenv('DB_PASSWORD') ?: (getenv('DB_PASS') ?: (getenv('MYSQLPASSWORD') ?: '')));
define('DB_NAME', getenv('DB_DATABASE') ?: (getenv('DB_NAME') ?: (getenv('MYSQLDATABASE') ?: 'eco_warrior')));
define('DB_PORT', getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: 3306));

// --- ADMIN CREDENTIALS ---
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: 'password');

// --- PUSHER CREDENTIALS ---
define('PUSHER_APP_ID', getenv('PUSHER_APP_ID'));
define('PUSHER_KEY', getenv('PUSHER_KEY'));
define('PUSHER_SECRET', getenv('PUSHER_SECRET'));
define('PUSHER_CLUSTER', getenv('PUSHER_CLUSTER'));

// Connect to Database
mysqli_report(MYSQLI_REPORT_OFF); // Disable exceptions so we can return JSON errors gracefully

$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);

// If DB doesn't exist, try connecting without it to create it (Localhost automation)
if ($conn->connect_errno == 1049) {
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, '', DB_PORT);
    if (!$conn->connect_error) {
        $conn->query("CREATE DATABASE IF NOT EXISTS " . DB_NAME);
        $conn->select_db(DB_NAME);
    }
}

if ($conn->connect_error) {
    die(json_encode(['success' => false, 'error' => 'Database Connection Failed: ' . $conn->connect_error]));
}

// Check if reports table exists
$table_check = $conn->query("SHOW TABLES LIKE 'reports'");
if ($table_check && $table_check->num_rows == 0) {
    // Read and execute database.sql to initialize schema
    $sql_file = __DIR__ . '/database.sql';
    if (file_exists($sql_file)) {
        $sql_content = file_get_contents($sql_file);
        $conn->multi_query($sql_content);
        // Ensure all multi queries finish
        while ($conn->more_results() && $conn->next_result()) {;}
    }
}

/**
 * Helper function to trigger a Pusher event using cURL (No Composer required)
 */
function triggerPusherEvent(string $channel, string $event, array $data): void {
    if (PUSHER_APP_ID === 'YOUR_APP_ID') return; // Skip if credentials are not set

    $payload = json_encode([
        'name' => $event,
        'channels' => [$channel],
        'data' => json_encode($data)
    ]);

    $auth_timestamp = time();
    $auth_version = '1.0';
    $body_md5 = md5($payload);

    $string_to_sign = implode("\n", [
        'POST',
        '/apps/' . PUSHER_APP_ID . '/events',
        'auth_key=' . PUSHER_KEY . '&auth_timestamp=' . $auth_timestamp . '&auth_version=' . $auth_version . '&body_md5=' . $body_md5
    ]);

    $auth_signature = hash_hmac('sha256', $string_to_sign, PUSHER_SECRET);

    $url = "https://api-" . PUSHER_CLUSTER . ".pusher.com/apps/" . PUSHER_APP_ID . "/events" . 
           "?body_md5=" . $body_md5 . 
           "&auth_version=" . $auth_version . 
           "&auth_key=" . PUSHER_KEY . 
           "&auth_timestamp=" . $auth_timestamp . 
           "&auth_signature=" . $auth_signature;

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_exec($ch);
    unset($ch); // curl_close is deprecated in PHP 8.5+
}
?>
