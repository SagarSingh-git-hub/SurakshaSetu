<?php
require_once '../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY) || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Gemini API key is not configured on the server']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No image data provided']);
    exit;
}

$imageBase64 = $data['image'];

// Extract mime type and base64 data
if (preg_match('/^data:(image\/\w+);base64,(.+)$/', $imageBase64, $matches)) {
    $mimeType = $matches[1];
    $base64Data = $matches[2];
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid image format']);
    exit;
}

$systemPrompt = <<<EOT
You are an expert environmental issue analyzer. Analyze the provided image and identify any civic or environmental issues.
Classify issues into categories such as: Garbage accumulation, Plastic waste, Open dumping, Construction debris, Industrial waste, Water pollution, Roadside littering, Illegal dumping, Overflowing waste bins, Sewage-related issues, Vegetation overgrowth, Plantation opportunities, Deforested or barren areas, Environmental hazards, etc. You are encouraged to dynamically add or identify other relevant civic or environmental issues according to your analysis.

Based on the image analysis, automatically generate relevant issue tags. Examples include: Plastic Waste, Open Dump, Garbage Accumulation, Construction Debris, Water Pollution, Plantation Opportunity. Tags MUST be generated dynamically from your analysis rather than strictly using predefined examples. You can add more highly specific tags according to what is genuinely present in the image.

Priority Scoring:
Assign a severity level: "High", "Medium", or "Low". Priority MUST be calculated based on:
- Estimated waste volume
- Environmental impact
- Public safety concerns
- Area coverage
- Severity of the detected issue

False Report Detection:
You MUST detect when the uploaded image does NOT contain an environmental issue. Examples of invalid images include: Clean roads, Clean parks, Clean residential areas, Indoor photos, Selfies, Random objects, Memes, Anime/cartoon images, Screenshots, Non-environmental content, and any other irrelevant images you detect.
In such cases:
- Set "issue_detected" to "None"
- Show tags like "No Environmental Issue Detected" or "Area Appears Clean"
- Assign "Low" priority
- Reduce the confidence score accordingly
- Set "is_valid_issue" to false to prevent incorrect issue tagging and flag the report as invalid.

You must respond strictly in JSON format matching the following structure:
{
  "issue_detected": "string (Short name of the issue, or 'None' if clean/invalid)",
  "tags": ["string", "string", "string"], // 2 to 4 relevant tags. Generated dynamically. If clean, use "Clean Area" or "No Environmental Issue Detected"
  "priority": "High" | "Medium" | "Low", // Based on waste volume, environmental impact, public safety. Use Low for invalid/clean.
  "confidence": number, // 0 to 100 representing confidence score
  "summary": "string", // Short explanation of what is seen and why it is an issue (or why it is not).
  "is_valid_issue": boolean, // true if an environmental issue is detected, false if clean, irrelevant, meme, etc.
  "suggested_category": "string" // Pick one of: "Garbage", "Plastic Waste", "Dirty Area", "Junkyard", "Water Pollution", "Plantation Opportunity", "Other"
}
EOT;

$payload = [
    'system_instruction' => [
        'parts' => [
            ['text' => $systemPrompt]
        ]
    ],
    'contents' => [
        [
            'parts' => [
                [
                    'text' => 'Analyze this image and provide the JSON response.'
                ],
                [
                    'inline_data' => [
                        'mime_type' => $mimeType,
                        'data' => $base64Data
                    ]
                ]
            ]
        ]
    ],
    'generationConfig' => [
        'response_mime_type' => 'application/json',
        'temperature' => 0.2
    ]
];

$ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' . GEMINI_API_KEY);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'cURL Error: ' . $error]);
    exit;
}

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Gemini API Error', 'details' => json_decode($response)]);
    exit;
}

$result = json_decode($response, true);
if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
    $aiText = $result['candidates'][0]['content']['parts'][0]['text'];
    $aiJson = json_decode($aiText, true);
    if ($aiJson) {
        echo json_encode(['success' => true, 'analysis' => $aiJson]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to parse AI response as JSON', 'raw' => $aiText]);
    }
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unexpected AI response format', 'raw' => $result]);
}
