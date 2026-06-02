let API_URL;
if (window.location.hostname.includes("localhost") || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.")) {
    // Localhost XAMPP URL (Handles www.localhost and local IPs)
    API_URL = window.location.origin + "/eco-warrior";
} else {
    // Railway Production URL
    API_URL = "https://surakshasetu-production.up.railway.app";
}
