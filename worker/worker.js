/* DIGBY /analyze — Cloudflare Workers AI backend (free, no API token).
 * Replaces the old AWS Lambda + OpenAI gpt-4o path.
 * Uses the env.AI binding; model @cf/openai/gpt-oss-120b.
 */

/* ─────────── Lish prompt (verbatim from Lambda handler.js) */
const buildLishPrompt = input => `
Edit this text like Gordon Lish at his sharpest:
• Cut anything that weakens tension or slows rhythm.
• Preserve striking images, odd metaphors, humor—but only if they deepen tension or reveal character.
• Preserve concrete nouns & physical actions; cut abstract commentary unless it carries irony or bite.
• Strip dialogue tags to “he said / she said,” kill redundant gestures.
• Limit most sentences to ≤ 12 words; allow one longer “swing” line per paragraph.
• Remove filler asides unless they add punch.
• Preserve ONE defining back-story or quirky fact per character if it anchors identity.
• Do NOT output em- or en-dashes.
Return only the edited text—no explanations.

TEXT:
"""${input}"""`.trim();

/* ─────────── Gonzo prompt (verbatim from Lambda handler.js) */
const buildGonzoPrompt = input => `
Edit this text in Hunter S. Thompson’s true gonzo fusion.
✅ Open each paragraph with a clean punch-sentence (≤ 12 words).
✅ Follow with ONE 25-word, polysyndetic riff.
✅ Inject first-person flashes, hyperbole, savage humour.
• Spike safe adjectives (“cold water ➜ hypothermic glacier drip”).
• Add one rogue simile per paragraph (“…like a raccoon rifling a trash can at 3 a.m.”).
• Allow em-dashes and ellipses; no ALL-CAPS, no italics.
Return only the edited text—no explanations.

TEXT:
"""${input}"""`.trim();

/* ─────────── Gatsby prompt (verbatim from Lambda handler.js) */
const buildGatsbyPrompt = input => `
Polish this text in the lyrical, disciplined style of F. Scott Fitzgerald circa *The Great Gatsby*:
• Marry elegance with precision—rhythmical yet never purple.
• Let vivid metaphor illuminate character or mood (“a voice like silver mint julep”); one fresh image per paragraph max.
• Prefer balanced clauses and musical commas; vary length (echo lull, then flare).
• Retain subtextual melancholy, understated irony; no slangier than original.
• Keep period-agnostic facts & names intact; do not modernise vocab.
Return only the edited text—no explanations.

TEXT:
"""${input}"""`.trim();

// NOTE: Access-Control-Allow-Origin is '*' for now. Once the front-end domain
// is confirmed, restrict this to 'https://digby.click' (and/or the GitHub
// Pages origin) instead of the wildcard.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });

export default {
  async fetch(req, env) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Use POST.' }, 405);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON.' }, 400);
    }

    const { text = '', style = 'lish' } = body || {};
    if (!text.trim()) return json({ error: 'Empty text.' }, 400);

    const prompt =
      style === 'gonzo'  ? buildGonzoPrompt(text)  :
      style === 'gatsby' ? buildGatsbyPrompt(text) :
                           buildLishPrompt(text);   // default lish

    try {
      // Llama 3.3 70B: fast non-reasoning instruct model, ideal for quick edits.
      // (gpt-oss-120b is "more powerful" but is a reasoning model that burns the
      // token budget thinking and returns empty text on longer inputs.)
      const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: 'You are a ruthless-but-wise editor.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1200
      });

      // Standard Workers AI shape is { response: "..." }; keep the OpenAI-shape
      // fallback in case the model ever returns choices[].
      let out = (r?.response || r?.choices?.[0]?.message?.content || '').trim();
      if (out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1);

      const fluff = Math.max(
        0,
        Math.round(((text.length - out.length) / text.length) * 100)
      );

      return json({ transformedText: out, fluff });
    } catch (err) {
      console.error(err);
      return json({ error: 'Server error.' }, 500);
    }
  }
};
