import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeMastra } from './src/mastra/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Mastra - promise to be awaited
let mastraPromise: Promise<any> | null = null;
let mastra: any = null;

function getMastraPromise() {
  if (!mastraPromise) {
    console.log('[Mastra] Starting initialization...');
    mastraPromise = initializeMastra()
      .then(m => {
        console.log('[Mastra] Initialization succeeded');
        console.log('[Mastra] Agents available:', m ? Object.keys(m.listAgents()) : 'none');
        mastra = m;
        return m;
      })
      .catch(error => {
        console.error('[Mastra] Initialization failed:', error);
        console.error('[Mastra] Error stack:', error instanceof Error ? error.stack : 'N/A');
        throw error;
      });
  }
  return mastraPromise;
}

// Structured logging utility
interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR';
  question: string;
  status: 'STARTED' | 'IN_PROGRESS' | 'SUCCESS' | 'ERROR';
  toolsCalled?: string[];
  latencyMs?: number;
  error?: string;
}

function logEvent(entry: LogEntry) {
  console.log(JSON.stringify({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString()
  }));
}

// Middleware
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await getMastraPromise();
    res.json({ status: 'ok', mastra: mastra ? 'ready' : 'not ready' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Mastra initialization failed' });
  }
});

// Main /ask endpoint
app.post('/ask', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logEvent({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    question: req.body.question || 'N/A',
    status: 'STARTED'
  });

  try {
    // Ensure mastra is initialized
    console.log('[Request] Awaiting Mastra initialization...');
    const m = await getMastraPromise();
    
    if (!m) {
      throw new Error('Mastra returned undefined');
    }
    const taraAgent = m.getAgent('taraAgent');

    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        question: 'N/A',
        status: 'ERROR',
        latencyMs: Date.now() - startTime,
        error: 'Invalid request: missing or non-string question field'
      });

      return res.status(400).json({
        error: 'Invalid request. Please provide a "question" field.',
      });
    }

    console.log(`[${requestId}] Processing question: ${question}`);

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      question: question,
      status: 'IN_PROGRESS'
    });

    // Run the Tara agent
    const response = await taraAgent.generate(question);

    // Extract the text response
    const answer = response.text || response.message?.content || 'I could not generate an answer.';

    const latencyMs = Date.now() - startTime;

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      question: question,
      status: 'SUCCESS',
      latencyMs: latencyMs,
      toolsCalled: response.toolCalls ? response.toolCalls.map((tc: any) => tc.toolName) : undefined
    });

    res.json({
      answer,
      question,
      requestId,
      latencyMs
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      question: req.body.question || 'N/A',
      status: 'ERROR',
      latencyMs: latencyMs,
      error: errorMsg
    });

    console.error(`[${requestId}] Error processing question:`, error);
    res.status(500).json({
      error: 'Failed to process your question. Please try again.',
      details: errorMsg,
      requestId
    });
  }
});

// Start server only if running locally (not on Vercel)
if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT, () => {
    console.log(`✓ Tara finance agent running on http://localhost:${PORT}`);
    console.log(`✓ POST /ask endpoint ready`);
    console.log(`✓ Structured logging enabled`);
  });
}

// Always initialize Mastra at module load - works for both local and Vercel
console.log('[Startup] Initializing Mastra...');
getMastraPromise().catch(error => {
  console.error('[Startup] Failed to initialize Mastra at module load:', error);
});

// Export for Vercel
export default app;
