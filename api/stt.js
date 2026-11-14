// Vercel serverless function: POST /api/stt (the lesson's backup speech-to-text). Key from the project env.
import { nodeHandler, handleStt } from '../server/otter.js';

export default function handler(req, res) {
  return nodeHandler(req, res, process.env, handleStt);
}
