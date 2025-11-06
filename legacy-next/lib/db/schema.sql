-- Lovepass Mail Database Schema
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ens TEXT NOT NULL,
    net TEXT NOT NULL DEFAULT 'mainnet',
    from_addr TEXT NOT NULL,
    to_addr TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    meta JSON
);

-- Index for efficient listing by ENS, network, and time
CREATE INDEX IF NOT EXISTS idx_messages_ens_net_created 
ON messages(ens, net, created_at DESC);

-- Index for efficient lookups by recipient
CREATE INDEX IF NOT EXISTS idx_messages_to_addr 
ON messages(to_addr);
