<?php
require '../../config.php';

$query = "SELECT id, name, email, phone, zone, role FROM community_members ORDER BY name ASC";
$result = $conn->query($query);

$members = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $members[] = $row;
    }
}

echo json_encode(['success' => true, 'data' => $members]);
?>
