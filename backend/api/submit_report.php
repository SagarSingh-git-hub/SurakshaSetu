<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $category = $conn->real_escape_string($_POST['category'] ?? '');
    $desc = $conn->real_escape_string($_POST['desc'] ?? '');
    $lat = (float)($_POST['lat'] ?? 0);
    $lng = (float)($_POST['lng'] ?? 0);
    $locStr = $conn->real_escape_string($_POST['locStr'] ?? '');
    
    // Generate Unique ID
    $report_id = 'ECO-' . rand(100, 999) . time();
    
    // --- [FUTURE PYTHON AI INTEGRATION PLACEHOLDER] ---
    /*
    // Example of sending data to Python before saving
    $python_api_url = "http://localhost:5000/analyze_report";
    $ai_data = ['description' => $desc, 'category' => $category];
    // Use cURL to POST $ai_data to $python_api_url
    // Receive AI response (e.g., Priority, Tags) and use them below
    */
    // -------------------------------------------------

    // Insert Report into Database
    $sql = "INSERT INTO reports (report_id, category, location_str, lat, lng, description) 
            VALUES ('$report_id', '$category', '$locStr', $lat, $lng, '$desc')";
            
    if ($conn->query($sql) === TRUE) {
        
        // Generate some basic tags based on category
        $tags = ['new'];
        $cat_lower = strtolower($category);
        if (strpos($cat_lower, 'garbage') !== false) { $tags[] = 'waste'; $tags[] = 'cleanup'; }
        elseif (strpos($cat_lower, 'plastic') !== false) { $tags[] = 'plastic'; $tags[] = 'recycle'; }
        elseif (strpos($cat_lower, 'water') !== false) { $tags[] = 'water'; $tags[] = 'pollution'; }
        elseif (strpos($cat_lower, 'dirty') !== false) { $tags[] = 'hygiene'; $tags[] = 'sanitation'; }
        elseif (strpos($cat_lower, 'junkyard') !== false) { $tags[] = 'scrap'; $tags[] = 'illegal-dumping'; }
        elseif (strpos($cat_lower, 'plantation') !== false) { $tags[] = 'greenery'; $tags[] = 'tree-planting'; }
        
        // Insert Tags
        foreach ($tags as $tag) {
            $db_tag = $conn->real_escape_string($tag);
            $conn->query("INSERT INTO report_tags (report_id, tag_name) VALUES ('$report_id', '$db_tag')");
        }
        
        $saved_photos = [];
        
        // Handle Photo Uploads (if any are sent via base64 strings in this example, or standard $_FILES)
        // Since frontend sends base64 array right now, we handle it:
        $upload_dir = __DIR__ . '/../uploads/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }

        if (isset($_POST['photos']) && is_array($_POST['photos'])) {
            foreach ($_POST['photos'] as $base64_string) {
                // Remove the "data:image/jpeg;base64," part
                $img = preg_replace('/^data:image\/\w+;base64,/', '', $base64_string);
                $img = str_replace(' ', '+', $img);
                $data = base64_decode($img);
                
                $filename = 'photo_' . uniqid() . '.jpg';
                $filepath = $upload_dir . $filename;
                
                // Save physical file
                if(file_put_contents($filepath, $data)) {
                    $saved_photos[] = 'backend/uploads/' . $filename;
                    // Save to DB
                    $db_filepath = $conn->real_escape_string('backend/uploads/' . $filename);
                    $conn->query("INSERT INTO report_photos (report_id, photo_path) VALUES ('$report_id', '$db_filepath')");
                }
            }
        }
        
        // Prepare data for Pusher broadcast
        $new_report_data = [
            'id' => $report_id,
            'cat' => $category,
            'loc' => $locStr,
            'lat' => $lat,
            'lng' => $lng,
            'desc' => $desc,
            'status' => 'Reported',
            'priority' => 'Medium',
            'date' => date('Y-m-d'),
            'photos' => count($saved_photos),
            'photo_urls' => $saved_photos,
            'tags' => $tags,
            'reporter' => 'Anonymous'
        ];

        // Trigger Pusher WebSocket Event
        triggerPusherEvent('eco-channel', 'new-report', $new_report_data);
        
        echo json_encode(['success' => true, 'report_id' => $report_id]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}
$conn->close();
?>
