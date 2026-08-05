/** Vercel serverless entry — loads bundled Express app from lib/ (built in buildCommand). */
const app = require("../lib/vercel-api.cjs");

module.exports = app;
module.exports.config = { maxDuration: 30 };
