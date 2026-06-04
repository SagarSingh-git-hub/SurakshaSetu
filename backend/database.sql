-- Table for Reports
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(20) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    location_str VARCHAR(255) NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Reported',
    priority VARCHAR(50) DEFAULT 'Medium',
    reporter VARCHAR(100) DEFAULT 'Anonymous',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for Photos (One-to-Many relationship with reports)
CREATE TABLE IF NOT EXISTS report_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(20) NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

-- Table for Tags (One-to-Many relationship with reports)
CREATE TABLE IF NOT EXISTS report_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(20) NOT NULL,
    tag_name VARCHAR(50) NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

-- Insert dummy data for initial map load
INSERT IGNORE INTO reports (report_id, category, location_str, lat, lng, description, status, priority) VALUES 
('ECO-001', 'Garbage', 'Nainital Road, Haldwani', 29.2183, 79.5130, 'Large pile of household waste.', 'Verified', 'High'),
('ECO-002', 'Water Pollution', 'Gaula River Ghat, Haldwani', 29.2100, 79.5250, 'Industrial discharge turning water dark.', 'In Progress', 'High');

INSERT IGNORE INTO report_tags (report_id, tag_name) VALUES
('ECO-001', 'waste'), ('ECO-001', 'cleanup'),
('ECO-002', 'water'), ('ECO-002', 'pollution');
