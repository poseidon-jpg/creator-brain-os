// What RUBRIC Storyboards (beta) asks your agent for, in two steps. Each prompt goes to AGENT_CMD on standard input.
// Step 1: a wireframe storyboard as JSON (a fast model is plenty; the schema is in the prompt, and the app cleans up
//         whatever comes back so it always plays).
// Step 2: the final video, built from the approved storyboard and the comments (a strong model, allowed to write files).

const ENTER = ['cut', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale-up', 'pop', 'type-on', 'draw', 'mask-reveal', 'drop', 'spin-in', 'blur-in'];
const EXIT = ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale-down', 'pop-out', 'wipe', 'blur-out'];
const MOVE = ['none', 'drift-left', 'drift-right', 'drift-up', 'drift-down', 'spin', 'pulse', 'orbit', 'float', 'grow', 'shrink'];
export const VOCAB = { ENTER, EXIT, MOVE };

export const WIREFRAME_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short working title' },
    logline: { type: 'string', description: 'One sentence: what the video is and how it should feel' },
    duration: { type: 'number', description: 'Total seconds' },
    aspect: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
    bpm: { type: 'number', description: 'Tempo the cuts land on' },
    look: { type: 'string', description: 'Palette, type and texture in one line' },
    sound: { type: 'string', description: 'Music and sound-effect plan in one line' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'One or two words' },
          start: { type: 'number' },
          end: { type: 'number' },
          idea: { type: 'string', description: 'What happens, in one or two sentences a motion designer can build from' },
          camera: { type: 'string', enum: ['static', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'orbit', 'shake'] },
          transition: { type: 'string', enum: ['cut', 'flash', 'wipe-left', 'wipe-right', 'wipe-up', 'dissolve', 'zoom-through', 'whip', 'iris', 'glitch'], description: 'How this scene hands over to the next' },
          bg: { type: 'string', enum: ['dark', 'light', 'accent', 'gradient', 'image'] },
          sfx: { type: 'string', description: 'Sound moments in this scene, short' },
          elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['text', 'shape', 'image', 'icon', 'ui', 'chart', 'particles', '3d', 'line', 'grid'] },
                label: { type: 'string', description: 'For text: the exact on-screen words. Otherwise: what it is' },
                shape: { type: 'string', enum: ['circle', 'rect', 'ring', 'triangle', 'hexagon', 'star', 'blob'] },
                x: { type: 'number', description: 'Centre, % of frame width' },
                y: { type: 'number', description: 'Centre, % of frame height' },
                w: { type: 'number', description: '% of frame width' },
                h: { type: 'number', description: '% of frame height' },
                accent: { type: 'boolean', description: 'true for the one element the eye should land on' },
                enter: { type: 'string', enum: ENTER },
                enter_at: { type: 'number', description: 'Seconds after the scene starts' },
                exit: { type: 'string', enum: EXIT },
                exit_at: { type: 'number', description: 'Seconds after the scene starts' },
                move: { type: 'string', enum: MOVE },
              },
              required: ['kind', 'label', 'x', 'y', 'w', 'h', 'enter', 'enter_at'],
            },
          },
        },
        required: ['name', 'start', 'end', 'idea', 'camera', 'transition', 'elements'],
      },
    },
  },
  required: ['title', 'logline', 'duration', 'aspect', 'scenes'],
};

export const WIREFRAME_SYSTEM = `You are a senior motion designer blocking out a video as a wireframe storyboard: a quick animatic spec that plays as grey boxes, so a reviewer can judge pacing, layout and flow before anything is built for real.

Return the storyboard as JSON that matches the schema.

How to block it out:
- Scenes run back to back from 0 to the full duration, with no gaps. Roughly one scene every 1.5 to 3 seconds; vary the lengths so it breathes.
- Pick a bpm and land scene changes on beats. Build energy: a hook in the first second, a peak near the end, a clean final frame.
- Each scene has 1 to 6 elements. Stagger their entrances (enter_at) instead of starting them all at once. Use exit only when something leaves before the scene ends.
- Positions are percentages of the frame: x and y are the element's centre, w and h its size. Keep everything inside the frame and away from the edges unless it is meant to bleed.
- Text labels are the exact on-screen words, short and punchy. Other labels say what the thing is ("brand logo", "revenue chart", "3,000 particles forming a word").
- Mark accent true on the one element per scene the eye should land on.
- The idea line tells the builder what really happens, including anything the boxes cannot show (texture, lighting, 3D, liquid, how a transition morphs).
- Plan the sound: the overall music feel in "sound", and hits per scene in "sfx".
- Be specific and cinematic. Avoid generic corporate beats.
- Never use the em dash or en dash characters; use a plain hyphen or a comma.

When you get a current storyboard and reviewer comments: apply every comment, keep everything else exactly as it was, and return the full storyboard.`;

/** Step 1 user message: a new request, or a revision with the comments. */
export function wireframeMessage({ request, duration, aspect, current, comments }) {
  const lines = [`Request: ${request}`, `Length: ${duration} seconds`, `Aspect: ${aspect}`];
  if (current) {
    lines.push('', 'Current storyboard:', JSON.stringify(current), '', 'Reviewer comments:');
    for (const c of comments) lines.push(`- ${describeComment(c, current)}`);
    lines.push('', 'Revise the storyboard: apply every comment, keep everything else the same, and return the full storyboard.');
  }
  return lines.join('\n');
}

/** Step 1 in full, as one prompt: how to block it out, the schema, the request (and the comments on a revision). */
export function wireframePrompt(args) {
  return [
    WIREFRAME_SYSTEM,
    '',
    'The JSON schema your answer must match:',
    JSON.stringify(WIREFRAME_SCHEMA),
    '',
    wireframeMessage(args),
    '',
    'Reply with only the JSON object: no code fence and no notes before or after it. Do not create or change any files.',
  ].join('\n');
}

export function describeComment(c, sb) {
  const scene = sb?.scenes?.find(s => c.t >= s.start && c.t < s.end);
  const where = c.x != null ? `, at about ${Math.round(c.x)}% across and ${Math.round(c.y)}% down` : '';
  return `at ${c.t.toFixed(2)}s${scene ? ` (scene "${scene.name}")` : ''}${where}: ${c.text}`;
}

/** Step 2 prompt: build the final video from the storyboard (and revise it from comments). */
export function finalPrompt({ request, sb, width, height, wfComments, finalComments, revising, imageBudget }) {
  const out = [
    revising ? 'Revise the video in this folder (index.html) from the reviewer comments below.' : 'Make the final video for this request, from the approved storyboard.',
    '',
    `Request: ${request}`,
    '',
    'The storyboard is in storyboard.json: a wireframe with scenes, timing, on-screen words, elements, motion, camera, transitions and a sound plan. Follow its scenes, timing and words. It is only a wireframe, so the look is yours: bring the craft, detail and polish a great motion designer would.',
  ];
  if (wfComments?.length) {
    out.push('', 'Reviewer comments on the wireframe (apply them):');
    for (const c of wfComments) out.push(`- ${describeComment(c, sb)}`);
  }
  if (finalComments?.length) {
    out.push('', 'Reviewer comments on the current video (apply every one, keep the rest as it is):');
    for (const c of finalComments) out.push(`- ${describeComment(c, sb)}`);
  }
  if (imageBudget > 0) out.push('', `You can also generate images with the generate_image tool (budget: $${imageBudget} in total; each call tells you what is left).`);
  out.push('',
    'Deliver index.html in this folder (other files beside it are fine). It is a code-rendered video:',
    `- ${width}x${height}, exactly ${sb.duration} seconds, 60 fps. Scale the stage to fit the window, centred on black.`,
    '- It plays on load and loops. No build step: plain HTML, CSS and JavaScript; libraries from a CDN are fine. It is served over http from this folder.',
    '- It exposes window.__reel = { duration, fps, width, height, seek(t), play(), pause(), time(), audio(sampleRate) }. seek(t) pauses and draws exactly the frame at time t, deterministically: every frame is a pure function of t, with no Math.random or wall-clock reads while drawing (seeded randomness is fine). time() returns the current time. audio(sampleRate) returns a Promise of { left, right } Float32Arrays holding the whole soundtrack rendered offline, or null if there is no sound. The app uses these to scrub the video and to export the MP4.',
    '- If the storyboard plans sound, make it with the Web Audio API (music and sound effects synced to the picture). Live playback may stay muted until the first click.',
    '- No on-screen controls or captions of your own; the app provides the player.',
    '- Never use the em dash or en dash characters in on-screen text.',
    '',
    'Work only inside this folder. Check your code carefully before you finish: if you can open the page in a headless browser, seek a few times and look; if not, read it through.',
  );
  return out.join('\n');
}
