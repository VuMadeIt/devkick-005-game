// Vercel serverless function: POST /api/otter. Keys come from the project's environment variables.
import { nodeHandler } from '../server/otter.js';

export default function handler(req, res) {
  return nodeHandler(req, res, process.env);
}
