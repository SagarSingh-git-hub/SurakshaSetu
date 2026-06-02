<?php
require_once __DIR__ . '/../config.php';

$sql = "SELECT r.*, 
       GROUP_CONCAT(DISTINCT p.photo_path) as photo_paths,
       GROUP_CONCAT(DISTINCT t.tag_name) as tag_names
        FROM reports r 
        LEFT JOIN report_photos p ON r.report_id = p.report_id 
        LEFT JOIN report_tags t ON r.report_id = t.report_id
        GROUP BY r.report_id 
        ORDER BY r.created_at DESC";
$result = $conn->query($sql);

$reports = [];

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $photos = [];
        if (!empty($row['photo_paths'])) {
            $photos = explode(',', $row['photo_paths']);
        }

        $tags = ['real-time']; // default tag
        if (!empty($row['tag_names'])) {
            $tags = explode(',', $row['tag_names']);
        }
        
        // Structure to match frontend expectations
        $reports[] = [
            'id' => $row['report_id'],
            'cat' => $row['category'],
            'loc' => $row['location_str'],
            'lat' => (float)$row['lat'],
            'lng' => (float)$row['lng'],
            'desc' => $row['description'],
            'status' => $row['status'],
            'priority' => $row['priority'],
            'date' => date('Y-m-d', strtotime($row['created_at'])),
            'photos' => count($photos),
            'photo_urls' => $photos,
            'tags' => $tags,
            'reporter' => $row['reporter']
        ];
    }
}

echo json_encode($reports);
$conn->close();
?>
