// Shared prompt-logging helper for the generate skill.
// MUST be called by every gen script after writing the media file.
// Writes a sidecar JSON next to the media file with the same basename
// (foo.jpg -> foo.json), capturing prompt + model + refs + params.
//
// Usage:
//   import { logGen } from './log-gen.mjs'; // adjust path from your script
//   logGen({
//     outputPath: 'generations/hero_banner_1234.jpg',
//     model: 'nano-banana-2-lite',
//     prompt: '...the full prompt text...',
//     refs: ['generations/refs/logo.png'],
//     params: { aspectRatio: '16:9', imageSize: '1K' },
//     // optional:
//     project: 'spring-campaign',
//     scriptPath: import.meta.url,
//     extra: { batch: 'thumb variants', sourceImage: '...' }
//   });

import fs from 'node:fs';
import path from 'node:path';

export function logGen({
  outputPath,
  model,
  prompt,
  refs = [],
  params = {},
  project = null,
  scriptPath = null,
  extra = {},
}) {
  if (!outputPath) throw new Error('logGen: outputPath required');
  if (!model) throw new Error('logGen: model required');
  if (!prompt) throw new Error('logGen: prompt required');

  const sidecarPath = outputPath.replace(/\.(jpg|jpeg|png|webp|mp4|webm|mov|gif)$/i, '.json');
  if (sidecarPath === outputPath) {
    throw new Error(`logGen: unrecognized media extension for ${outputPath}`);
  }

  const record = {
    output: path.basename(outputPath),
    outputPath,
    model,
    prompt,
    refs: refs.map((r) => (typeof r === 'string' ? r : r.path || r)),
    params,
    project,
    scriptPath: scriptPath ? scriptPath.replace(/^file:\/\/\//, '') : null,
    generatedAt: new Date().toISOString(),
    ...extra,
  };

  fs.writeFileSync(sidecarPath, JSON.stringify(record, null, 2));
  return sidecarPath;
}
