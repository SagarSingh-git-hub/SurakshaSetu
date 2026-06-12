<?php
// Initialize Cloudinary SDK
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

// Attempt to configure Cloudinary if variables are present
if (getenv('CLOUDINARY_CLOUD_NAME') && getenv('CLOUDINARY_API_KEY') && getenv('CLOUDINARY_API_SECRET')) {
    $configClass = '\Cloudinary\Configuration\Configuration';
    if (class_exists($configClass)) {
        try {
            $configClass::instance([
                'cloud' => [
                    'cloud_name' => getenv('CLOUDINARY_CLOUD_NAME'),
                    'api_key'    => getenv('CLOUDINARY_API_KEY'),
                    'api_secret' => getenv('CLOUDINARY_API_SECRET')
                ],
                'url' => [
                    'secure' => true
                ]
            ]);
        } catch (\Exception $e) {
            error_log("Cloudinary configuration failed: " . $e->getMessage());
        }
    }
}
?>
