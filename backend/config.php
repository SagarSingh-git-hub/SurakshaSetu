<?php
// Configuration File
$frontend_url = getenv('FRONTEND_URL') ?: '*';
$frontend_url = rtrim(trim($frontend_url, "`'\" "), '/'); // Remove trailing slashes and quotes
if (getenv('APP_ENV') === 'development' && isset($_SERVER['HTTP_ORIGIN'])) {
    $frontend_url = $_SERVER['HTTP_ORIGIN']; // Auto-allow local origins for testing
}
header('Access-Control-Allow-Origin: ' . $frontend_url); // Restrict origins in production
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

// Security Headers
header("X-Frame-Options: DENY");
header("X-Content-Type-Options: nosniff");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
header("Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:;");

if (($_SERVER['REQUEST_METHOD'] ?? '') == 'OPTIONS') {
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
        if (strpos($line, '=') === false) continue;
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
define('DB_PORT', getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: 3307));

// --- ADMIN CREDENTIALS ---
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: 'password');

// --- PUSHER CREDENTIALS ---
define('PUSHER_APP_ID', getenv('PUSHER_APP_ID'));
define('PUSHER_KEY', getenv('PUSHER_KEY'));
define('PUSHER_SECRET', getenv('PUSHER_SECRET'));
define('PUSHER_CLUSTER', getenv('PUSHER_CLUSTER'));

// --- GEMINI API ---
define('GEMINI_API_KEY', getenv('GEMINI_API_KEY'));

// Connect to Database
mysqli_report(MYSQLI_REPORT_OFF); // Disable exceptions so we can return JSON errors gracefully

$conn = mysqli_init();

// Aiven MySQL requires SSL. We must set the MYSQLI_CLIENT_SSL flag if we are in production.
$flags = 0;
if (getenv('APP_ENV') === 'production' || strpos(DB_HOST, 'aivencloud.com') !== false) {
    $conn->ssl_set(NULL, NULL, NULL, NULL, NULL);
    $flags = MYSQLI_CLIENT_SSL;
    if (defined('MYSQLI_CLIENT_SSL_DONT_VERIFY_SERVER_CERT')) {
        $flags |= MYSQLI_CLIENT_SSL_DONT_VERIFY_SERVER_CERT;
    }
}

$connected = @$conn->real_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT, NULL, $flags);

// If DB doesn't exist, try connecting without it to create it (Localhost automation)
if (!$connected && $conn->connect_errno == 1049) {
    $conn = mysqli_init();
    if ($flags) $conn->ssl_set(NULL, NULL, NULL, NULL, NULL);
    $connected = @$conn->real_connect(DB_HOST, DB_USER, DB_PASS, '', DB_PORT, NULL, $flags);
    if ($connected && !empty(DB_NAME)) {
        $conn->query("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`");
        $conn->select_db(DB_NAME);
    }
}

if (!$connected) {
    if (php_sapi_name() === 'cli' && basename($_SERVER['PHP_SELF']) === 'system_monitor.php') {
        // Do not die, allow system_monitor to handle the failure
    } else {
        die(json_encode(['success' => false, 'error' => 'Database Connection Failed: ' . $conn->connect_error]));
    }
}

// IP BLOCK CHECKER
$client_ip = $_SERVER['REMOTE_ADDR'] ?? '';
if (!empty($client_ip)) {
    // Check if the IP is active and not expired in blocked_ips table
    $blocked_query = "SELECT * FROM blocked_ips WHERE ip_address = ? AND status = 'Blocked' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1";
    $stmt = $conn->prepare($blocked_query);
    if ($stmt) {
        $stmt->bind_param('s', $client_ip);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res && $res->num_rows > 0) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'IP_BLOCKED',
                'message' => 'Your IP address (' . htmlspecialchars($client_ip) . ') has been blocked due to security reasons.'
            ]);
            exit();
        }
        $stmt->close();
    }
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
 * Helper function to recursively sanitize websocket payloads to mask emails, IPs, and exclude metadata.
 */
function sanitize_pusher_payload(array $data): array {
    $sanitized = [];
    foreach ($data as $key => $value) {
        if (is_array($value)) {
            $sanitized[$key] = sanitize_pusher_payload($value);
        } else if (is_string($value)) {
            // Mask email addresses
            if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $parts = explode('@', $value);
                $name = $parts[0];
                $domain = $parts[1];
                if (strlen($name) <= 2) {
                    $masked_name = str_repeat('*', strlen($name));
                } else {
                    $masked_name = substr($name, 0, 1) . str_repeat('*', strlen($name) - 2) . substr($name, -1);
                }
                $value = $masked_name . '@' . $domain;
            }
            // Mask IP addresses
            elseif (filter_var($value, FILTER_VALIDATE_IP)) {
                $parts = explode('.', $value);
                if (count($parts) === 4) {
                    $value = $parts[0] . '.' . $parts[1] . '.***.***';
                } else {
                    $value = substr($value, 0, 8) . ':****:****:****';
                }
            }
            // Mask custom text if it contains IP or email pattern
            else {
                // regex for IP
                $value = preg_replace('/(\b\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}\b/', '$1***.***', $value);
                // regex for email
                $value = preg_replace('/([a-zA-Z0-9._%+-]+)(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/', '***$2', $value);
            }
            $sanitized[$key] = $value;
        } else {
            $sanitized[$key] = $value;
        }
    }
    // Remove internal database metadata if present
    unset($sanitized['admin_password']);
    unset($sanitized['token']);
    unset($sanitized['password']);
    unset($sanitized['session_token']);
    
    return $sanitized;
}

/**
 * Helper function to trigger a Pusher event using cURL (No Composer required).
 * Forces private channel and sanitizes payloads automatically.
 */
function triggerPusherEvent(string $channel, string $event, array $data): void {
    if (PUSHER_APP_ID === 'YOUR_APP_ID' || empty(PUSHER_APP_ID)) return; // Skip if credentials are not set

    // Force private channel for all admin/app notifications
    $channel = 'private-eco-channel';

    // Sanitize payload data
    $data = sanitize_pusher_payload($data);

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
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_exec($ch);
    unset($ch); // curl_close is deprecated in PHP 8.5+
}

/**
 * Fallback for getallheaders() if not running under Apache
 */
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $header_name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$header_name] = $value;
            }
        }
        return $headers;
    }
}

/**
 * Middleware to check for valid admin session token and return user details.
 * Enforces Role-Based Access Control (RBAC).
 */
function check_admin_session(string $required_role = 'Admin'): array {
    global $conn;
    
    $headers = getallheaders();
    $auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $token = '';
    
    if (preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
        $token = $matches[1];
    } elseif (isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'UNAUTHORIZED', 'message' => 'Authentication token required.']);
        exit();
    }
    
    // Query session token from DB
    $stmt = $conn->prepare("SELECT user_id, ip_address, status FROM login_sessions WHERE token = ? LIMIT 1");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error.']);
        exit();
    }
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$res || $res['status'] !== 'Active') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'UNAUTHORIZED', 'message' => 'Session expired or invalid.']);
        exit();
    }
    
    // Map email to role
    $email = $res['user_id'];
    $role = 'Admin'; // Default
    if ($email === 'admin@surakshasetu.org') {
        $role = 'Super Admin';
    }
    
    // Enforce role check
    if ($required_role === 'Super Admin' && $role !== 'Super Admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Super Admin privileges required.']);
        exit();
    }
    
    return [
        'email' => $email,
        'role' => $role,
        'ip_address' => $res['ip_address'],
        'token' => $token
    ];
}

/**
 * Log a security-sensitive action to the dedicated audit_logs table.
 */
function log_audit_action(string $actor, string $action, string $target, $before_state = null, $after_state = null): void {
    global $conn;
    
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $before_str = $before_state !== null ? json_encode($before_state) : null;
    $after_str = $after_state !== null ? json_encode($after_state) : null;
    
    $stmt = $conn->prepare("INSERT INTO audit_logs (actor, action, target, ip_address, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param('ssssss', $actor, $action, $target, $ip_address, $before_str, $after_str);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * File-based rate limiter to protect POST endpoints.
 */
function check_rate_limit(string $action_name, int $limit = 30, int $period = 60): void {
    $client_ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    
    $cache_dir = __DIR__ . '/../tmp/rate_limit';
    if (!file_exists($cache_dir)) {
        @mkdir($cache_dir, 0777, true);
    }
    
    $ip_hash = md5($client_ip . '_' . $action_name);
    $file_path = "$cache_dir/$ip_hash.json";
    
    $now = time();
    $requests = [];
    if (file_exists($file_path)) {
        $raw = @file_get_contents($file_path);
        $data = json_decode($raw, true);
        if (is_array($data)) {
            foreach ($data as $ts) {
                if ($now - $ts < $period) {
                    $requests[] = $ts;
                }
            }
        }
    }
    
    if (count($requests) >= $limit) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error' => 'RATE_LIMIT_EXCEEDED',
            'message' => 'Too many requests. Please slow down and try again later.'
        ]);
        exit();
    }
    
    $requests[] = $now;
    @file_put_contents($file_path, json_encode($requests));
}
?>
