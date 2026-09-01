/*
# Enable pgcrypto for SHA-256 digest function used in verify_phone_password
*/
CREATE EXTENSION IF NOT EXISTS pgcrypto;
