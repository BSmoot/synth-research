/**
 * Agent exports for Synthesis Labs
 */

export { BaseAgent, type AgentConfig } from './base-agent.js';
export { DomainAnalystAgent, type DomainAnalysisRequest } from './domain-analyst.js';
export { CrossPollinatorAgent, type PollinationRequest } from './cross-pollinator.js';
export {
  HypothesisSynthesizerAgent,
  type SynthesisRequest,
  type SynthesisResult,
} from './hypothesis-synthesizer.js';
export {
  HypothesisChallengerAgent,
  type ChallengeRequest,
  type ChallengeResult,
} from './hypothesis-challenger.js';
export { HypothesisIntegratorAgent } from './hypothesis-integrator.js';
