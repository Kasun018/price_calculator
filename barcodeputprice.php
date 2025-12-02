<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Allow CORS for testing
include_once __DIR__ . '/db.php'; //DB connection

// Get barcode from URL
$barcode = isset($_GET['barcode']) ? trim($_GET['barcode']) : '';

if (!$barcode) {
    echo json_encode(['error' => 'No barcode provided']);
    exit;
}

// Query product from database
$stmt = $conn->prepare("SELECT product_name, price FROM products WHERE barcode = ? LIMIT 1");
$stmt->bind_param("s", $barcode);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    echo json_encode([
        'product_name' => $row['product_name'],
        'price' => floatval($row['price'])
    ]);
} else {
    echo json_encode(['error' => 'Product not found']);
}

$stmt->close();
$conn->close();
?>