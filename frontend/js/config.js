let API_URL;
if (window.location.hostname.includes("localhost") || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.")) {
    // Localhost XAMPP URL (Dynamically detects subfolder to handle SurakshaSetu / eco-warrior automatically)
    const pathParts = window.location.pathname.split('/');
    const frontendIndex = pathParts.indexOf('frontend');
    if (frontendIndex > 1) {
        const rootFolder = pathParts[frontendIndex - 1];
        API_URL = window.location.origin + "/" + rootFolder + "/backend";
    } else {
        API_URL = window.location.origin + "/backend";
    }
} else {
    // Render Production URL
    API_URL = "https://surakshasetu-api.onrender.com";
}
