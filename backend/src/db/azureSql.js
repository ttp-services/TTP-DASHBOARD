/**
 * Azure SQL connection pool – secure, never expose this to the frontend.
 * Uses environment variables only.
 */
import sql from 'mssql';

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt:true,
    trustServerCertificate:true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

export async function getPool() {
  if (!config.server || !config.database) {
    throw new Error('Azure SQL config missing: set AZURE_SQL_SERVER and AZURE_SQL_DATABASE in .env');
  }
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

export async function query(querystr, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(querystr);
}

export async function close() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
