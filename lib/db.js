'use strict';

/**
 * Neon Postgres client voor Vercel serverless functies.
 * Gebruikt de HTTP-driver van @neondatabase/serverless — werkt zonder TCP-socket.
 * Vereist env var: POSTGRES_URL (automatisch gezet door Vercel Neon-integratie).
 */

const { neon } = require('@neondatabase/serverless');

let _sql = null;

function getClient() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'POSTGRES_URL ontbreekt. Voeg Neon toe via de Vercel Marketplace ' +
      'of zet POSTGRES_URL in je .env bestand.'
    );
  }
  if (!_sql) _sql = neon(process.env.POSTGRES_URL);
  return _sql;
}

/**
 * Voert een SQL-query uit en retourneert de rijen.
 * @param {string}   text    Parameterised SQL (gebruik $1, $2, ...)
 * @param {Array}    params  Parameterwaarden
 * @returns {Promise<Array>}
 */
async function query(text, params) {
  const sql = getClient();
  return sql(text, params || []);
}

/**
 * Atomair: alle statements committen of geen.
 * @param {Array<[string, Array]>} stmts  Array van [text, params]-tupels
 */
async function transaction(stmts) {
  const sql = getClient();
  const queries = stmts.map(([text, params]) => sql.query(text, params || []));
  return sql.transaction(queries);
}

module.exports = { query, transaction };
