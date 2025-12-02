<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Allow CORS for testing
include_once __DIR__ . '/db.php';

// Validate input
if (!isset($_GET['barcode']) || trim($_GET['barcode']) === '') {
    echo json_encode(["error" => "missing_barcode"]);
    exit;
}

$barcode = trim($_GET['barcode']);

// Prepared statement to avoid SQL injection
$stmt = $conn->prepare("SELECT price, product_name FROM products WHERE barcode = ? LIMIT 1");
if (!$stmt) {
    echo json_encode(["error" => "db_error"]);
    exit;
}
$stmt->bind_param("s", $barcode);
$stmt->execute();
$res = $stmt->get_result();

if ($row = $res->fetch_assoc()) {
    echo json_encode([
        "price" => (float)$row['price'],
        "product_name" => $row['product_name']
    ]);
} else {
    echo json_encode(["error" => "not_found"]);
}

$stmt->close();
$conn->close();
?>