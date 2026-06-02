<?php
// Configuration File
header('Access-Control-Allow-Origin: *'); // Allow requests from any origin during development
header('Content-Type: application/json');

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
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'eco_warrior');
define('DB_PORT', getenv('DB_PORT') ?: 3307); // Added Port 3307 based on my.ini

// --- PUSHER CREDENTIALS ---
define('PUSHER_APP_ID', getenv('PUSHER_APP_ID'));
define('PUSHER_KEY', getenv('PUSHER_KEY'));
define('PUSHER_SECRET', getenv('PUSHER_SECRET'));
define('PUSHER_CLUSTER', getenv('PUSHER_CLUSTER'));

// Connect to Database
mysqli_report(MYSQLI_REPORT_OFF); // Disable exceptions so we can return JSON errors gracefully
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, '', DB_PORT);

if ($conn->connect_error) {
    die(json_encode(['success' => false, 'error' => 'Database Connection Failed: ' . $conn->connect_error]));
}

// Auto-create database and tables if they don't exist (Automation)
$conn->query("CREATE DATABASE IF NOT EXISTS " . DB_NAME);
$conn->select_db(DB_NAME);

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
function triggerPusherEvent($channel, $event, $data) {
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
    curl_close($ch);
}
?>
