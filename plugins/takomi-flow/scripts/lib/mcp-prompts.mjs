import * as z from 'zod/v4';
import { collectPrompt, imagePrompt, reviewPrompt, videoPrompt } from './prompts.mjs';

export function registerPrompts(server) {
  server.registerPrompt('takomi_flow_video_workflow', {
    description: 'Guide an agent through a safe TakomiFlow video generation workflow.',
    argsSchema: {
      topic: z.string().optional(),
      aspectRatio: z.string().optional(),
      variations: z.string().optional(),
    },
  }, args => videoPrompt(args));

  server.registerPrompt('takomi_flow_image_workflow', {
    description: 'Guide an agent through a safe TakomiFlow image generation workflow.',
    argsSchema: {
      topic: z.string().optional(),
      aspectRatio: z.string().optional(),
      variations: z.string().optional(),
    },
  }, args => imagePrompt(args));

  server.registerPrompt('takomi_flow_review_workflow', {
    description: 'Guide an agent through reviewing TakomiFlow run results and assets.',
    argsSchema: {
      run: z.string().optional(),
      frames: z.string().optional(),
    },
  }, args => reviewPrompt(args));

  server.registerPrompt('takomi_flow_collect_workflow', {
    description: 'Guide an agent through collecting reviewed TakomiFlow outputs into a downstream folder.',
    argsSchema: {
      run: z.string().optional(),
      targetDir: z.string().optional(),
      includeFrames: z.string().optional(),
    },
  }, args => collectPrompt(args));
}
