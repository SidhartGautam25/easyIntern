import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root of server
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || 'https://unqfphgjilxpbzajcdjl.supabase.co',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  
  // SMTP
  smtpHost: process.env.SMTP_HOST || 'smtp.hostinger.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || 'noreply@ezyintern.in',
  smtpPass: process.env.SMTP_PASS || 'Ezyintern@Bhopal&2026',
};

// Simple sanity check
if (!config.supabaseServiceRoleKey || config.supabaseServiceRoleKey === 'placeholder_please_replace_with_actual_service_role_key') {
  console.warn('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY is not configured or is a placeholder. Write operations to database tables requiring permissions will fail.');
}
