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

-- Table for Community Members
CREATE TABLE IF NOT EXISTS community_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    zone VARCHAR(100),
    role VARCHAR(50) DEFAULT 'Community Member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for Certificate Templates
CREATE TABLE IF NOT EXISTS certificate_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    award_type VARCHAR(100),
    bg_gradient VARCHAR(100) DEFAULT 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(34,197,94,0.06))',
    primary_color VARCHAR(20) DEFAULT 'var(--gold)',
    secondary_color VARCHAR(20) DEFAULT 'var(--t3)',
    icon_class VARCHAR(50) DEFAULT 'ti ti-award',
    html_content LONGTEXT NULL,
    is_custom_html BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    usage_count INT DEFAULT 0,
    last_used DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for Certificates
CREATE TABLE IF NOT EXISTS certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cert_id VARCHAR(50) UNIQUE NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(20),
    recipient_zone VARCHAR(100),
    certificate_type VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL,
    citation TEXT NOT NULL,
    issuing_authority VARCHAR(100) NOT NULL,
    co_signatory VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    template_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE SET NULL
);

-- Insert dummy data for Community Members
INSERT IGNORE INTO community_members (name, email, phone, zone, role) VALUES 
('Priya Sharma', 'priya.sharma@surakshasetu.in', '+91 98765 43210', 'Central & East Agra', 'Moderator'),
('Rohit Kumar', 'rohit.k@surakshasetu.in', '+91 98765 43211', 'North Agra', 'Moderator'),
('Vikas Pandey', 'vikas.p@gmail.com', '+91 98765 43212', 'East Agra', 'Field Reporter'),
('Anita Singh', 'anita.s@gmail.com', '+91 98765 43213', 'West Agra', 'Field Reporter');

-- Insert default Templates
INSERT IGNORE INTO certificate_templates (name, award_type, bg_gradient, primary_color, secondary_color, icon_class, is_default) VALUES 
('Classic Gold', 'Community Champion', 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(34,197,94,0.06))', 'var(--gold)', 'var(--t3)', 'ti ti-award', TRUE),
('Eco Blue', 'Eco Warrior Award', 'linear-gradient(135deg,rgba(96,165,250,0.08),rgba(34,197,94,0.04))', 'var(--blue)', 'var(--t3)', 'ti ti-leaf', FALSE),
('Volunteer Purple', 'Volunteer Excellence', 'linear-gradient(135deg,rgba(167,139,250,0.08),rgba(34,197,94,0.04))', 'var(--purple)', 'var(--t3)', 'ti ti-heart', FALSE),
('Drive Green', 'Drive Completion', 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(251,191,36,0.04))', 'var(--acc2)', 'var(--t3)', 'ti ti-check', FALSE);

-- Table for Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    reference_id VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    location VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
