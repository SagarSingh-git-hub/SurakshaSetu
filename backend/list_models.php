<?php
require_once 'config.php';
$response = file_get_contents('https://generativelanguage.googleapis.com/v1beta/models?key=' . GEMINI_API_KEY);
$data = json_decode($response, true);
foreach($data['models'] as $m) {
    if (strpos($m['name'], 'flash') !== false) {
        echo $m['name'] . "\n";
    }
}
