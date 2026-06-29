<?php
require_once '../config.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

// Handle GET requests (List/Search/Filter tickets)
if ($method === 'GET') {
    try {
        $pdo = new PDO("mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? 'All';

        $query = "SELECT * FROM support_tickets WHERE 1=1";
        $params = [];

        if (!empty($search)) {
            $query .= " AND (ticket_id LIKE ? OR subject LIKE ? OR description LIKE ? OR category LIKE ?)";
            $searchParam = "%$search%";
            $params = array_merge($params, [$searchParam, $searchParam, $searchParam, $searchParam]);
        }

        if ($status !== 'All') {
            $query .= " AND status = ?";
            $params[] = $status;
        }

        $query .= " ORDER BY created_at DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'tickets' => $tickets]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle POST requests (Create ticket)
if ($method === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || !isset($data['subject']) || !isset($data['category']) || !isset($data['priority']) || !isset($data['description'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    try {
        $pdo = new PDO("mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Generate unique Ticket ID
        $prefix = 'TKT-';
        $stmt = $pdo->query("SELECT MAX(CAST(SUBSTRING(ticket_id, 5) AS UNSIGNED)) as max_id FROM support_tickets");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $nextId = $row['max_id'] ? (int)$row['max_id'] + 1 : 1;
        $ticketId = $prefix . str_pad($nextId, 4, '0', STR_PAD_LEFT);

        $stmt = $pdo->prepare("INSERT INTO support_tickets (ticket_id, subject, category, priority, description, reporter_name, email, phone, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->execute([
            $ticketId,
            trim($data['subject']),
            trim($data['category']),
            trim($data['priority']),
            trim($data['description']),
            trim($data['reporter_name'] ?? ''),
            trim($data['email'] ?? ''),
            trim($data['phone'] ?? ''),
            trim($data['location'] ?? '')
        ]);

        $newTicketId = $pdo->lastInsertId();
        
        $stmt = $pdo->prepare("SELECT * FROM support_tickets WHERE id = ?");
        $stmt->execute([$newTicketId]);
        $newTicket = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'ticket' => $newTicket]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle PUT requests (Update ticket status/priority)
if ($method === 'PUT') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || !isset($data['ticket_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ticket ID is required']);
        exit;
    }

    try {
        $pdo = new PDO("mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $updates = [];
        $params = [];

        if (isset($data['status'])) {
            $updates[] = "status = ?";
            $params[] = $data['status'];
        }
        if (isset($data['priority'])) {
            $updates[] = "priority = ?";
            $params[] = $data['priority'];
        }

        if (empty($updates)) {
            echo json_encode(['success' => true, 'message' => 'No changes provided']);
            exit;
        }

        $params[] = $data['ticket_id'];

        $sql = "UPDATE support_tickets SET " . implode(', ', $updates) . " WHERE ticket_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['success' => true, 'message' => 'Ticket updated successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
