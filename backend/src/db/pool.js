import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const localDatabase = ['localhost', '127.0.0.1', '::1', 'test'].includes(env.dbHost);
const useTls = !localDatabase || process.env.DB_SSL === 'true';
const ca = process.env.DB_SSL_CA?.replace(/\\n/g, '\n') ||
  (process.env.DB_SSL_CA_FILE ? readFileSync(process.env.DB_SSL_CA_FILE, 'utf8') : undefined);

export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  timezone: "+08:00",
  ...(useTls ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  // Fail fast instead of hanging for minutes if the DB host is unreachable
  // or the credentials are wrong — Render will show the real error.
  connectTimeout: 10000,
  enableKeepAlive: true,
});

// mysql2's timezone option converts JS dates; SET time_zone controls SQL NOW/CURDATE.
pool.on('connection', connection => {
  connection.query("SET time_zone = '+08:00'", error => {
    if (error) { console.error('Database timezone initialization failed'); connection.destroy(); }
  });
});

export async function testDbConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
