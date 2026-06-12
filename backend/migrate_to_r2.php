<?php
/**
 * Migration Script: Cloudinary / Local to Cloudflare R2
 * This script will scan the report_photos table, download existing images,
 * upload them to Cloudflare R2, and update the database schema and rows.
 */

// WARNING: This script should ideally be run from CLI. If run from web, it might timeout.
set_time_limit(0); 

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api/StorageService.php';

use App\Services\StorageService;

$storage = new StorageService();

echo "Checking database schema...\n";

// 1. Ensure columns exist
$checkColsSql = "SHOW COLUMNS FROM report_photos LIKE 'object_key'";
$result = $conn->query($checkColsSql);
if ($result->num_rows == 0) {
    echo "Altering table to add R2 columns...\n";
    $alterSql = "ALTER TABLE report_photos 
                 ADD COLUMN object_key VARCHAR(255) DEFAULT NULL,
                 ADD COLUMN original_filename VARCHAR(255) DEFAULT NULL,
                 ADD COLUMN mime_type VARCHAR(50) DEFAULT NULL,
                 ADD COLUMN file_size INT DEFAULT NULL,
                 ADD COLUMN uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP";
    $conn->query($alterSql);
    echo "Database schema updated successfully.\n";
}

if (!$storage->isConfigured()) {
    die("R2 is not configured. Please set R2 environment variables to continue data migration.\n");
}

echo "Starting migration to Cloudflare R2...\n";

// 2. Fetch all photos that haven't been migrated yet (object_key is NULL)
$sql = "SELECT id, report_id, photo_path FROM report_photos WHERE object_key IS NULL OR object_key = ''";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    echo "Found " . $result->num_rows . " photos to migrate.\n";
    
    while ($row = $result->fetch_assoc()) {
        $id = $row['id'];
        $reportId = $row['report_id'];
        $path = $row['photo_path'];
        
        echo "Processing ID $id for Report $reportId: $path\n";
        
        $urlToFetch = $path;
        if (!preg_match('/^https?:\/\//', $path)) {
            // It's a local file path
            $urlToFetch = __DIR__ . '/../' . $path;
            if (!file_exists($urlToFetch)) {
                $urlToFetch = __DIR__ . '/' . $path; // fallback
            }
        }
        
        $imgData = @file_get_contents($urlToFetch);
        
        if ($imgData === false) {
            echo "  -> Failed to download/read image. Skipping.\n";
            continue;
        }
        
        $base64 = base64_encode($imgData);
        // Determine mime type roughly
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->buffer($imgData);
        if (!$mime) $mime = 'image/jpeg';
        
        $base64String = 'data:' . $mime . ';base64,' . $base64;
        
        $uniq = uniqid();
        $ext = ($mime == 'image/png') ? 'png' : 'jpg';
        $objectKey = "reports/{$reportId}/photo_{$uniq}.{$ext}";
        
        $uploadResult = $storage->uploadBase64($base64String, $objectKey);
        
        if ($uploadResult !== false) {
            echo "  -> Uploaded to R2 successfully: {$uploadResult['object_key']}\n";
            
            // Update database
            $stmt = $conn->prepare("UPDATE report_photos SET object_key=?, mime_type=?, file_size=? WHERE id=?");
            $stmt->bind_param("ssii", $uploadResult['object_key'], $uploadResult['mime_type'], $uploadResult['file_size'], $id);
            $stmt->execute();
            $stmt->close();
        } else {
            echo "  -> Failed to upload to R2.\n";
        }
    }
} else {
    echo "No photos pending migration.\n";
}

echo "Migration complete.\n";
$conn->close();
?>
