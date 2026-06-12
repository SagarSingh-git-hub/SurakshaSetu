<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/log_activity.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $category = $_POST['category'] ?? '';
    $desc = $_POST['desc'] ?? '';
    $lat = (float)($_POST['lat'] ?? 0);
    $lng = (float)($_POST['lng'] ?? 0);
    $locStr = $_POST['locStr'] ?? '';
    $device_id = $_POST['device_id'] ?? '';
    
    // 1. Generate a temporary ID (to bypass UNIQUE constraint)
    $temp_id = uniqid('tmp_');
    
    // Insert Report into Database
    $stmt = $conn->prepare("INSERT INTO reports (report_id, category, location_str, lat, lng, description, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssdsss", $temp_id, $category, $locStr, $lat, $lng, $desc, $device_id);
            
    if ($stmt->execute()) {
        $inserted_id = $conn->insert_id;
        // 2. Format sequential ID based on auto-increment id
        $report_id = 'ECO-0' . $inserted_id;
        
        // 3. Update the temporary ID with the permanent sequential ID
        $update_stmt = $conn->prepare("UPDATE reports SET report_id = ? WHERE id = ?");
        $update_stmt->bind_param("si", $report_id, $inserted_id);
        $update_stmt->execute();
        $update_stmt->close();
        
        // 4. Return early response to client to make submission "near-instant"
        ob_end_clean();
        header("Connection: close\r\n");
        header("Content-Encoding: none\r\n");
        ignore_user_abort(true);
        ob_start();
        echo json_encode(['success' => true, 'report_id' => $report_id]);
        $size = ob_get_length();
        header("Content-Length: $size\r\n");
        ob_end_flush();
        flush();
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        if (session_id()) {
            session_write_close();
        }

        // --- BACKGROUND PROCESSING CONTINUES ---

        
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
        $tag_stmt = $conn->prepare("INSERT INTO report_tags (report_id, tag_name) VALUES (?, ?)");
        foreach ($tags as $tag) {
            $tag_stmt->bind_param("ss", $report_id, $tag);
            $tag_stmt->execute();
        }
        $tag_stmt->close();
        
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
                    $saved_photos[] = 'uploads/' . $filename;
                    // Save to DB
                    $db_filepath = 'uploads/' . $filename;
                    $photo_stmt = $conn->prepare("INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)");
                    $photo_stmt->bind_param("ss", $report_id, $db_filepath);
                    $photo_stmt->execute();
                    $photo_stmt->close();
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
            'reporter' => 'Anonymous',
            'device_id' => $device_id
        ];

        // Trigger Pusher WebSocket Event
        triggerPusherEvent('eco-channel', 'new-report', $new_report_data);
        
        logActivity($conn, 'Report Created', $report_id, "Report #$report_id created in $locStr", $category, $locStr);
        
        // Response was already sent. Activity logged in background.
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}
$conn->close();
?>
