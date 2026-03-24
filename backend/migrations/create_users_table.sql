-- Create the users table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100),
        username NVARCHAR(50) UNIQUE NOT NULL,
        email NVARCHAR(100),
        password NVARCHAR(MAX) NOT NULL, 
        role NVARCHAR(20) DEFAULT 'viewer',
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- Seed the initial Admin (Abdul) and Viewer (Robbert)
INSERT INTO users (name, username, email, password, role)
SELECT 'Abdul Rahman', 'admin_ttp', 'abdul@ttp.services', 'admin2026', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin_ttp');

INSERT INTO users (name, username, email, password, role)
SELECT 'Robbert Jan Tel', 'robbert_viewer', 'robbert@ttp.services', 'view2026', 'viewer'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'robbert_viewer');