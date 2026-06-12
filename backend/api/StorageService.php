<?php

namespace App\Services;

if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

use Aws\S3\S3Client;
use Aws\Exception\AwsException;

class StorageService {
    private $s3Client;
    private $bucket;
    private $publicUrl;

    public function __construct() {
        $accountId = getenv('R2_ACCOUNT_ID');
        $accessKeyId = getenv('R2_ACCESS_KEY_ID');
        $secretAccessKey = getenv('R2_SECRET_ACCESS_KEY');
        $this->bucket = getenv('R2_BUCKET');
        $this->publicUrl = getenv('R2_PUBLIC_URL'); // e.g., https://pub-xxxxxxxx.r2.dev

        if ($accountId && $accessKeyId && $secretAccessKey && $this->bucket) {
            $this->s3Client = new S3Client([
                'region' => 'auto',
                'endpoint' => "https://{$accountId}.r2.cloudflarestorage.com",
                'version' => 'latest',
                'credentials' => [
                    'key' => $accessKeyId,
                    'secret' => $secretAccessKey,
                ]
            ]);
        }
    }

    /**
     * @return bool True if R2 credentials are fully provided and initialized
     */
    public function isConfigured() {
        return $this->s3Client !== null;
    }

    /**
     * Uploads base64 encoded image data directly to Cloudflare R2
     * 
     * @param string $base64Data The base64 string
     * @param string $objectKey The destination path in the bucket (e.g., 'reports/eco-001/file.jpg')
     * @return array|false Returns metadata array on success, false on failure
     */
    public function uploadBase64($base64Data, $objectKey) {
        if (!$this->isConfigured()) return false;

        try {
            // Decode base64
            if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
                $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
                $mimeType = 'image/' . strtolower($type[1]);
            } else {
                $mimeType = 'image/jpeg'; // fallback
            }

            $imgData = base64_decode(str_replace(' ', '+', $base64Data));
            if ($imgData === false) return false;
            
            $fileSize = strlen($imgData);

            $result = $this->s3Client->putObject([
                'Bucket' => $this->bucket,
                'Key' => $objectKey,
                'Body' => $imgData,
                'ContentType' => $mimeType,
                'ACL' => 'public-read' // R2 doesn't technically use ACLs the same way, but it's safe to include
            ]);

            return [
                'object_key' => $objectKey,
                'mime_type' => $mimeType,
                'file_size' => $fileSize,
                'url' => rtrim($this->publicUrl, '/') . '/' . ltrim($objectKey, '/')
            ];

        } catch (AwsException $e) {
            error_log("R2 Upload Failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generates the public CDN URL for an object key
     */
    public function getPublicUrl($objectKey) {
        if (!$this->publicUrl || empty($objectKey)) {
            return $objectKey; // return as is if it's already an absolute URL or local path
        }
        
        // If it's already an absolute URL, return it
        if (strpos($objectKey, 'http://') === 0 || strpos($objectKey, 'https://') === 0) {
            return $objectKey;
        }

        return rtrim($this->publicUrl, '/') . '/' . ltrim($objectKey, '/');
    }
}
?>
