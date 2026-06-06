
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { taraAgent } from './agents/tara-agent.js';

async function initializeMastra() {
  const mastra = new Mastra({
    agents: { taraAgent },
    logger: new PinoLogger({
      name: 'Mastra',
      level: 'info',
    }),
  });

  console.log('[Mastra] Registered agents:', Object.keys(mastra.listAgents()));

  return mastra;
}

export { initializeMastra };
