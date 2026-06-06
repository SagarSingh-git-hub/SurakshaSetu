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

if (!$data || (!isset($data['image']) && !isset($data['images']))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No image data provided']);
    exit;
}

$images = [];
if (isset($data['images']) && is_array($data['images'])) {
    $images = $data['images'];
} elseif (isset($data['image'])) {
    $images = [$data['image']];
}

$imageParts = [];
foreach ($images as $imageBase64) {
    if (preg_match('/^data:(image\/\w+);base64,(.+)$/', $imageBase64, $matches)) {
        $mimeType = $matches[1];
        $base64Data = $matches[2];
        $imageParts[] = [
            'inline_data' => [
                'mime_type' => $mimeType,
                'data' => $base64Data
            ]
        ];
    }
}

if (empty($imageParts)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid image format or no valid images provided']);
    exit;
}

$systemPrompt = <<<EOT
You are an expert environmental issue analyzer. Analyze ALL uploaded images together, not just the first image.

Instructions:
- Review every uploaded image in the batch before generating the analysis.
- Combine observations from all images and identify common patterns, violations, and environmental issues.
- Do not generate the result based on a single image.
- Consider the entire set of uploaded images as one incident/report.
- If different images show different waste types or violations, include all relevant categories in the final analysis.
- Calculate confidence and priority based on the combined evidence from all images.
- Generate a single consolidated report containing: Detected Issues, Waste Categories, Environmental Impact, Public Health Risks, Priority Level, Confidence Score, Overall Summary.

Important:
If multiple images are uploaded, analyze all images first, then generate one unified AI Analysis. Never stop analysis after the first image.

Classify issues into categories such as: Garbage accumulation, Plastic waste, Open dumping, Construction debris, Industrial waste, Water pollution, Roadside littering, Illegal dumping, Overflowing waste bins, Sewage-related issues, Vegetation overgrowth, Plantation opportunities, Deforested or barren areas, Environmental hazards, etc. You are encouraged to dynamically add or identify other relevant civic or environmental issues according to your analysis.

Based on the combined image analysis, automatically generate relevant issue tags. Examples include: Plastic Waste, Open Dump, Garbage Accumulation, Construction Debris, Water Pollution, Plantation Opportunity. Tags MUST be generated dynamically from your analysis rather than strictly using predefined examples. You can add more highly specific tags according to what is genuinely present in the images.

Priority Scoring:
Assign a severity level: "High", "Medium", or "Low". Priority MUST be calculated based on the combined evidence:
- Estimated total waste volume across all images
- Environmental impact
- Public safety concerns
- Area coverage
- Severity of the detected issues

False Report Detection:
You MUST detect when the uploaded images do NOT contain an environmental issue. Examples of invalid images include: Clean roads, Clean parks, Clean residential areas, Indoor photos, Selfies, Random objects, Memes, Anime/cartoon images, Screenshots, Non-environmental content, and any other irrelevant images you detect.
In such cases:
- Set "issue_detected" to "None"
- Show tags like "No Environmental Issue Detected" or "Area Appears Clean"
- Assign "Low" priority
- Reduce the confidence score accordingly
- Set "is_valid_issue" to false to prevent incorrect issue tagging and flag the report as invalid.

You must respond strictly in JSON format matching the following structure. The "summary" field MUST contain the consolidated report (Detected Issues, Waste Categories, Environmental Impact, Public Health Risks, Overall Summary):
{
  "issue_detected": "string (Short combined name of the issues, or 'None' if clean/invalid)",
  "tags": ["string", "string", "string"], // 2 to 4 relevant tags. Generated dynamically. If clean, use "Clean Area" or "No Environmental Issue Detected"
  "priority": "High" | "Medium" | "Low", // Based on waste volume, environmental impact, public safety. Use Low for invalid/clean.
  "confidence": number, // 0 to 100 representing confidence score based on combined evidence
  "summary": "string", // Comprehensive consolidated report of all images.
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
            'parts' => array_merge(
                [['text' => 'Analyze these images and provide the JSON response based on the system instructions.']],
                $imageParts
            )
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
