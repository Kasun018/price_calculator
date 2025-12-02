<?php
header('Content-Type: application/json');

// Database connection
$DB_HOST = "localhost";
$DB_USER = "root";
$DB_PASS = "";      // WAMP default is empty
$DB_NAME = "shop";

$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed: " . $conn->connect_error]);
    exit;
}
$conn->set_charset("utf8mb4");

// Get barcode from URL
$barcode = isset($_GET['barcode']) ? trim($_GET['barcode']) : '';

if (!$barcode) {
    echo json_encode(['error' => 'No barcode provided']);
    exit;
}

// Query product from database
$stmt = $conn->prepare("SELECT name, price FROM products WHERE barcode = ? LIMIT 1");
$stmt->bind_param("s", $barcode);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    echo json_encode([
        'product_name' => $row['name'],
        'price' => floatval($row['price'])
    ]);
} else {
    echo json_encode(['error' => 'Product not found']);
}

$stmt->close();
$conn->close();
