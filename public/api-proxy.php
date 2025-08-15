<?php
// Enhanced error reporting for debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Log errors to a file for debugging (adjust path as needed)
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// CORS headers for browser compatibility
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Optional override via query string: ?target=local | hosted | http(s)://host:port
$targetOverride = isset($_GET['target']) ? trim($_GET['target']) : '';
$overrideUrl = null;
if ($targetOverride) {
    if (preg_match('/^https?:\/\//i', $targetOverride)) {
        $overrideUrl = rtrim($targetOverride, '/');
    } elseif (strcasecmp($targetOverride, 'hosted') === 0) {
        $overrideUrl = 'https://api.thediscourse.ai';
    } elseif (strcasecmp($targetOverride, 'local') === 0) {
        // Try common local URLs explicitly
        $overrideUrl = 'http://localhost:4003';
    }
}

// Node.js server configuration - prefer local first for dev, then hosted API
$possibleUrls = [
    // Local/dev instances (non-TLS)
    'http://localhost:4003',
    'http://127.0.0.1:4003',
    'http://0.0.0.0:4003',
    'http://localhost:3000',
    'http://127.0.0.1:3000',

    // VPS IP (non-TLS by default)
    'http://31.97.115.145:4003',

    // TLS variants
    'https://localhost:4003',
    'https://127.0.0.1:4003',
    'https://31.97.115.145:4003',

    // Hosted API (last, so dev uses local data; production will fall back here)
    'https://api.thediscourse.ai/'
];

$nodeServerUrl = null;
$connectionErrors = [];

// If override present, test it first
if ($overrideUrl) {
    $testUrl = $overrideUrl;
    $healthUrl = rtrim($testUrl, '/') . '/api/health';
    $testCh = curl_init();
    curl_setopt($testCh, CURLOPT_URL, $healthUrl);
    curl_setopt($testCh, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($testCh, CURLOPT_TIMEOUT, 2);
    curl_setopt($testCh, CURLOPT_CONNECTTIMEOUT, 1);
    curl_setopt($testCh, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($testCh, CURLOPT_SSL_VERIFYHOST, false);
    $testResponse = curl_exec($testCh);
    $testError = curl_error($testCh);
    $testHttpCode = curl_getinfo($testCh, CURLINFO_HTTP_CODE);
    curl_close($testCh);
    if (!$testError && $testHttpCode === 200) {
        $nodeServerUrl = $testUrl;
        error_log("PHP Proxy: Using override Node.js server at: " . $testUrl);
    } else {
        $connectionErrors[$testUrl] = "(override) Error: $testError, HTTP Code: $testHttpCode";
    }
}

// Try each possible URL to find the working one if override failed or not set
if (!$nodeServerUrl) {
    foreach ($possibleUrls as $testUrl) {
        $healthUrl = rtrim($testUrl, '/') . '/api/health';
        $testCh = curl_init();
        curl_setopt($testCh, CURLOPT_URL, $healthUrl);
        curl_setopt($testCh, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($testCh, CURLOPT_TIMEOUT, 2);
        curl_setopt($testCh, CURLOPT_CONNECTTIMEOUT, 1);
        curl_setopt($testCh, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($testCh, CURLOPT_SSL_VERIFYHOST, false);
        $testResponse = curl_exec($testCh);
        $testError = curl_error($testCh);
        $testHttpCode = curl_getinfo($testCh, CURLINFO_HTTP_CODE);
        curl_close($testCh);
        
        if (!$testError && $testHttpCode === 200) {
            $nodeServerUrl = $testUrl;
            error_log("PHP Proxy: Found working Node.js server at: " . $testUrl);
            break;
        } else {
            $connectionErrors[$testUrl] = "Error: $testError, HTTP Code: $testHttpCode";
        }
    }
}

// If no working server found, return detailed error
if (!$nodeServerUrl) {
    error_log("PHP Proxy: Cannot reach any Node.js server. Tried: " . implode(', ', $possibleUrls));
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Backend server unavailable',
        'details' => 'No Node.js server found at any expected location',
        'attempted_urls' => $possibleUrls,
        'connection_errors' => $connectionErrors,
        'suggestions' => [
            'Check if Node.js server is running: ps aux | grep node',
            'Start the server: node server.js',
            'Check server logs for errors',
            'Verify the server is listening on the correct port'
        ]
    ]);
    exit;
}

// Add debugging
error_log("PHP Proxy: Using Node.js server at: " . $nodeServerUrl);
error_log("PHP Proxy: Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("PHP Proxy: Request URI: " . $_SERVER['REQUEST_URI']);

// Expose proxy target for diagnostics
header('X-Proxy-Target: ' . $nodeServerUrl);

// Gets the requested path from the URL
if (isset($_SERVER['PATH_INFO'])) {
    $requestPath = trim($_SERVER['PATH_INFO'], '/');
} elseif (isset($_GET['path'])) {
    $requestPath = $_GET['path'];
} else {
    // Extract path from REQUEST_URI if PATH_INFO is not available
    $requestUri = $_SERVER['REQUEST_URI'];
    $scriptName = $_SERVER['SCRIPT_NAME'];
    $requestPath = str_replace($scriptName, '', $requestUri);
    $requestPath = trim($requestPath, '/');
    
    // Remove query string if present
    if (($pos = strpos($requestPath, '?')) !== false) {
        $requestPath = substr($requestPath, 0, $pos);
    }
}

// Enhanced path extraction for /api-proxy.php/api/* requests
$requestUri = $_SERVER['REQUEST_URI'];
error_log("PHP Proxy: Original REQUEST_URI: " . $requestUri);

// Handle different URL patterns
if (strpos($requestUri, '/api-proxy.php/') !== false) {
    // Extract everything after /api-proxy.php/
    $parts = explode('/api-proxy.php/', $requestUri, 2);
    if (count($parts) === 2) {
        $requestPath = $parts[1];
        // Remove query string if present
        if (($pos = strpos($requestPath, '?')) !== false) {
            $requestPath = substr($requestPath, 0, $pos);
        }
        $requestPath = trim($requestPath, '/');
        error_log("PHP Proxy: Extracted path from /api-proxy.php/ pattern: " . $requestPath);
    }
} elseif (isset($_SERVER['PATH_INFO'])) {
    $requestPath = trim($_SERVER['PATH_INFO'], '/');
    error_log("PHP Proxy: Using PATH_INFO: " . $requestPath);
} elseif (isset($_GET['path'])) {
    $requestPath = $_GET['path'];
    error_log("PHP Proxy: Using GET path parameter: " . $requestPath);
} else {
    // Fallback: Extract path from REQUEST_URI
    $scriptName = $_SERVER['SCRIPT_NAME'];
    $requestPath = str_replace($scriptName, '', $requestUri);
    $requestPath = trim($requestPath, '/');
    
    // Remove query string if present
    if (($pos = strpos($requestPath, '?')) !== false) {
        $requestPath = substr($requestPath, 0, $pos);
    }
    error_log("PHP Proxy: Fallback path extraction: " . $requestPath);
}

// Ensure the path starts with 'api' for proper forwarding
if (!empty($requestPath) && strpos($requestPath, 'api/') !== 0) {
    error_log("PHP Proxy: Warning - path doesn't start with 'api/': " . $requestPath);
}

error_log("PHP Proxy: Final extracted path: " . $requestPath);

// Constructs the full URL to the Node.js server
// Build base URL + path
$baseUrl = rtrim($nodeServerUrl, '/');
$pathOnly = ltrim($requestPath, '/');
$url = $baseUrl . '/' . $pathOnly;

// Append original query string if present so GET parameters are preserved
if (!empty($_SERVER['QUERY_STRING'])) {
    $url .= (strpos($url, '?') === false ? '?' : '&') . $_SERVER['QUERY_STRING'];
}

// Log the request for debugging
error_log("PHP Proxy: Forwarding " . $_SERVER['REQUEST_METHOD'] . " request to: " . $url);

// Initialize cURL session
$ch = curl_init();

// Set cURL options with better error handling
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// Increase timeout for course generation requests
if (strpos($requestPath, 'courses/generate') !== false) {
    curl_setopt($ch, CURLOPT_TIMEOUT, 1200); // 20 minutes for course generation
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
    error_log("PHP Proxy: Using extended timeout (1200s) for course generation");
} else {
    curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30 seconds for other requests
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
}

curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

// Copy request headers (excluding problematic ones)
$headers = [];
$skipHeaders = ['host', 'content-length', 'connection', 'accept-encoding'];

foreach (getallheaders() as $name => $value) {
    if (!in_array(strtolower($name), $skipHeaders)) {
        $headers[] = $name . ': ' . $value;
    }
}

// Ensure content-type is set for JSON requests
if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $hasContentType = false;
    foreach ($headers as $header) {
        if (stripos($header, 'content-type:') === 0) {
            $hasContentType = true;
            break;
        }
    }
    if (!$hasContentType) {
        $headers[] = 'Content-Type: application/json';
    }
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Handle different HTTP methods
switch ($_SERVER['REQUEST_METHOD']) {
    case 'POST':
        curl_setopt($ch, CURLOPT_POST, true);
        $postData = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        error_log("PHP Proxy: POST data: " . $postData);
        break;
        
    case 'PUT':
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        $putData = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $putData);
        error_log("PHP Proxy: PUT data: " . $putData);
        break;
        
    case 'DELETE':
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        break;
        
    case 'GET':
    default:
        // GET is default, no additional setup needed
        break;
}

// Handle streaming responses differently
if (strpos($requestPath, 'courses/generate') !== false) {
    // Also expose full target for streaming responses
    header('X-Proxy-Request-URL: ' . $url);
    error_log("PHP Proxy: Setting up streaming response for course generation");
    error_log("PHP Proxy: Target URL: " . $url);
    error_log("PHP Proxy: Request method: " . $_SERVER['REQUEST_METHOD']);
    
    // Set streaming headers
    http_response_code(200);
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Cache-Control');
    
    // Disable output buffering for streaming
    if (ob_get_level()) {
        ob_end_clean();
    }
    
    // Configure cURL for streaming
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
        error_log("PHP Proxy: Received " . strlen($data) . " bytes from backend");
        
        // Validate that we're receiving proper SSE data
        if (strlen($data) > 0) {
            // Check if this looks like SSE data
            if (strpos($data, 'data: ') === 0 || strpos($data, "\n") !== false) {
                error_log("PHP Proxy: Valid SSE data received: " . substr($data, 0, 100) . "...");
            } else {
                error_log("PHP Proxy: Warning - data doesn't look like SSE format: " . substr($data, 0, 100));
            }
        }
        
        // Forward data immediately without buffering
        echo $data;
        flush();
        if (ob_get_level()) {
            ob_flush();
        }
        return strlen($data);
    });
    
    // Execute the streaming request
    $result = curl_exec($ch);
    
    if (curl_errno($ch)) {
        $error_msg = curl_error($ch);
        $error_code = curl_errno($ch);
        error_log("PHP Proxy: Streaming cURL Error #" . $error_code . ": " . $error_msg);
        
        // Send error as SSE event
        echo "data: " . json_encode([
            'type' => 'error',
            'message' => 'Proxy connection failed',
            'details' => $error_msg
        ]) . "\n\n";
    } else {
        error_log("PHP Proxy: Streaming completed successfully");
    }
    
    curl_close($ch);
    error_log("PHP Proxy: Streaming response completed");
    exit;
}

// Execute the cURL request
$response = curl_exec($ch);

// Check for cURL errors with detailed logging
if (curl_errno($ch)) {
    $error_msg = curl_error($ch);
    $error_code = curl_errno($ch);
    error_log("PHP Proxy: cURL Error #" . $error_code . ": " . $error_msg);
    
    http_response_code(500);
    header('Content-Type: application/json');
    // Provide richer diagnostics back to the client
    echo json_encode([
        'error' => 'Proxy connection failed',
        'details' => $error_msg,
        'curl_error_code' => $error_code,
        'target_url' => $url,
        'proxy_target' => $nodeServerUrl,
        'attempted_urls' => $possibleUrls
    ]);
    curl_close($ch);
    exit;
}

// Get response info
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

// Log response for debugging
error_log("PHP Proxy: Response code: " . $httpcode . " Content-Type: " . $contentType);

// Set response headers for non-streaming responses
http_response_code($httpcode);
if ($contentType) {
    header('Content-Type: ' . $contentType);
}
// Expose full target for non-streaming responses as well
header('X-Proxy-Request-URL: ' . $url);

// Add CORS headers to response
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Output the response
echo $response;

// Log successful completion
error_log("PHP Proxy: Successfully forwarded request to " . $url . " - Response code: " . $httpcode);
?> 