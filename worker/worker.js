/* DIGBY /analyze — Cloudflare Workers AI backend (free, no API token).
 *
 * DIGBY is an EDITING TOOL and a TOY, not a writer. It works WITH the writer's
 * own words: it cuts, sharpens, and nudges their prose toward a chosen sensibility.
 * It never ghostwrites from scratch or replaces the writer's voice with pure
 * imitation. The human stays the author. This philosophy lives in SYSTEM + the
 * lens framing in buildPrompt, not just the UI copy.
 *
 * Uses the env.AI binding; model @cf/qwen/qwen3-30b-a3b-fp8 (thinking OFF).
 *
 * Request body: { text, style, intensity?, customVoice? }
 *   style       — a key in STYLES, or 'custom'
 *   intensity   — 'light' | 'medium' | 'savage' (default 'medium')
 *   customVoice — free-text voice description, used when style === 'custom'
 * Response: { transformedText, fluff, note }
 */

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

const SYSTEM =
  "You are DIGBY, a sharp and encouraging line editor, NOT a ghostwriter. " +
  "You work with the writer's OWN words and ideas: you cut, tighten, reorder, " +
  "and nudge the prose toward a given sensibility. You never invent new plot, " +
  "new facts, or replace the writing wholesale with imitation. The writer stays " +
  "the author. Your job is to help a human see their own prose through a lens " +
  "and make it sharper and theirs. /no_think";

/* ─────────── Style lenses (the sensibility — framing + intensity added below) */
const STYLES = {
  /* Cut it down */
  lish: `Edit like Gordon Lish, the ruthless minimalist editor:
• Cut anything that weakens tension or slows rhythm.
• Keep concrete nouns and physical action; strip abstract commentary unless it has bite.
• Most sentences 12 words or fewer; one longer "swing" line per paragraph.`,

  hemingway: `Edit like Ernest Hemingway (iceberg theory):
• Short, true, declarative sentences; one idea each.
• Concrete nouns, strong verbs, almost no adjectives or adverbs.
• Say less than you know; understate the emotion and let the facts carry it.`,

  'elmore-leonard': `Edit like Elmore Leonard:
• Leave out the parts readers skip; cut throat-clearing and weather reports.
• Lean, fast dialogue that sounds spoken; "said" is the only tag you need.
• Keep it cool and propulsive; never show off the prose.`,

  beckett: `Edit like Samuel Beckett:
• Pare to the bone; bleak, dry comedy in the gaps.
• Use repetition and hesitation; let failure and persistence coexist.
• Short clauses, plain words, a stubborn rhythm that goes on.`,

  /* Let it sing */
  gatsby: `Polish like F. Scott Fitzgerald circa The Great Gatsby:
• Elegant and precise, rhythmical yet never purple.
• One fresh illuminating metaphor per paragraph, no more.
• Balanced clauses, musical commas, an undertow of melancholy.`,

  'donna-tartt': `Edit like Donna Tartt:
• Lush, erudite, slow-burning dread beneath beauty.
• Precise sensory detail and classical allusion that earn their place.
• Long, controlled sentences that build atmosphere and unease.`,

  mccarthy: `Edit like Cormac McCarthy:
• Biblical, incantatory cadence; long sentences joined by "and."
• Sparse punctuation and NO quotation marks around dialogue.
• Stark elemental imagery: land, fire, blood, dark, bone.`,

  murakami: `Edit like Haruki Murakami (in translation):
• Calm, deadpan voice describing the quietly surreal as ordinary.
• Clean plain sentences; small precise details (jazz, a cat, a well).
• Let the uncanny sit unexplained; melancholy, a little lonely.`,

  'sylvia-plath': `Edit like Sylvia Plath:
• Confessional intensity; fierce, exact, startling images.
• Hard consonants and vivid color; the body and its dread.
• Compress until each line stings; no soft abstraction.`,

  'george-eliot': `Edit like George Eliot:
• Victorian moral intelligence; psychological depth under the narration.
• Long balanced sentences with wise, slightly ironic commentary.
• Trace motive and conscience; take the inner life seriously.`,

  'colson-whitehead': `Edit like Colson Whitehead:
• Cool, precise prose with sudden dry wit and historical weight.
• Clean modern sentences that turn and surprise.
• Let irony and clear-eyed observation carry the emotion.`,

  /* Break the form */
  dfw: `Edit like David Foster Wallace:
• Hyper-aware, recursive, generous maximalism; qualify and complicate.
• Precise technical vocabulary beside casual speech.
• Long branching sentences with asides; anxious sincerity underneath.`,

  'joyce-ulysses': `Edit like James Joyce in Ulysses mode:
• Stream of consciousness; thought jumping associatively mid-sentence.
• Fuse sense impression, memory, and fragment without smoothing.
• Drop some connective tissue; trust rhythm and interior logic.`,

  'joyce-wake': `Edit like James Joyce in Finnegans Wake mode (for those who KNOW):
• Dream-language: portmanteau words, multilingual puns, musical nonsense-sense.
• Bend spelling and fuse words to carry double and triple meanings.
• Rivverrun rhythm over plain clarity; sound is meaning here.`,

  'charlie-kaufman': `Edit like Charlie Kaufman:
• Anxious, meta, recursive interiority; the mind watching itself.
• Mundane detail collides with existential vertigo.
• Let the narration doubt itself and fold back on the premise.`,

  /* Stage & screen */
  'arthur-miller': `Edit like Arthur Miller:
• Plainspoken American dialogue carrying moral and tragic weight.
• Ordinary people under pressure; dignity and self-deception.
• Let subtext and conscience drive the lines; nothing ornamental.`,

  'sam-shepard': `Edit like Sam Shepard:
• Raw, mythic American voice; deserts, families, broken men.
• Spare, charged dialogue with menace and dark humor in the silence.
• Plain words, sudden poetry, a dreamlike instability under the realism.`,

  'rod-serling': `Edit like Rod Serling (Twilight Zone narration):
• Measured, ominous, morally pointed voice-over cadence.
• Set the ordinary scene, then tilt it toward the uncanny.
• Build to a quiet turn that reframes everything; wry and humane.`,

  'spike-lee': `Edit like Spike Lee:
• Urgent, rhythmic, direct; unafraid of the political and personal.
• New York in the bones; voice that addresses the reader head-on.
• Jump-cut energy, heat, and moral insistence; make it matter now.`,

  'chuck-jones': `Edit like a Chuck Jones Looney Tunes cartoon:
• Zany, kinetic, impeccable comic timing; cartoon logic rules.
• Exaggeration, the long pause before the gag, a wink to the audience.
• Keep it fast and gleeful; a safe always lands on cue.`,

  /* Get the story */
  gonzo: `Edit in Hunter S. Thompson's gonzo fusion:
• Open each paragraph with a clean punch-sentence (12 words or fewer).
• Follow with one polysyndetic riff; first-person flashes, savage humor.
• One rogue simile per paragraph; em-dashes and ellipses welcome.`,

  'susan-orlean': `Edit like Susan Orlean (narrative nonfiction):
• Warm, curious, humane; find the wonder in an ordinary subject.
• Vivid reported detail and gentle wit; the writer present but modest.
• Clean, graceful sentences that make the overlooked fascinating.`,

  'jimmy-breslin': `Edit like Jimmy Breslin, the street-level columnist:
• Tell it from the common man, not the podium; the gravedigger, not the general.
• Short, punchy, tabloid-poetic sentences with working-class New York music.
• Concrete names and places; moral anger under the plain talk.`,

  /* Heart on sleeve */
  'danielle-steel': `Edit like Danielle Steel:
• Sweeping romantic melodrama; big feeling worn openly.
• Glamour, destiny, and emotional stakes; love and loss turned up.
• Smooth propulsive sentences that keep the heart turning the page.`,

  bronte: `Edit like the Brontes (gothic romantic):
• Passionate, windswept, interior; moors, weather, and longing.
• Heightened emotion and moral intensity in formal 19th-century cadence.
• Let landscape mirror feeling; love and dread entwined.`,

  hallmark: `Edit like a Hallmark holiday-movie writer:
• Cozy, wholesome, gently predictable warmth; small-town charm.
• Simple sincere dialogue, twinkle lights, second chances, cocoa.
• Soft stakes and a reassuring glow; everything will be okay.`,

  /* Just fix it */
  plain: `Rewrite in clear, plain English anyone can read:
• Kill jargon, buzzwords, and acronyms; say the real thing.
• Short common words, short sentences, active voice.
• Keep every fact and number; only the wrapping changes.`,

  corporate: `Strip the corporate-speak and make it sound human:
• Delete buzzwords (synergy, leverage, circle back, bandwidth, ideate).
• Replace hedging with plain, direct statements; cut filler openers.
• Warm and specific, like a smart person talking, not a press release.`
};

const INTENSITY = {
  light: 'LIGHT touch: keep the writer\'s sentence order and structure, but you MUST still apply the lens visibly, elevate word choice and add a few lens-appropriate textures so the style is clearly felt in every paragraph. Restrained, but never a mere copyedit (changing only punctuation is a failure).',
  medium: 'MEDIUM touch: confidently reshape sentences, diction, and rhythm into the lens. The lens must be UNMISTAKABLE on the page, while the writer\'s content, ideas, and meaning stay intact.',
  savage: 'SAVAGE touch: fully transform the prose into the lens, rebuild sentence architecture and voice, while still editing the writer\'s OWN material (same content, same ideas, same facts). Invent no new plot or facts.'
};

const buildPrompt = ({ text, style, intensity, customVoice }) => {
  const lens =
    style === 'custom'
      ? `Edit this writer's text through the following sensibility they described:\n"""${(customVoice || '').slice(0, 400)}"""`
      : (STYLES[style] || STYLES.lish);

  const dose = INTENSITY[intensity] || INTENSITY.medium;

  return `${lens}

${dose}

This is a STYLE edit, not a copyedit. You MUST visibly reshape diction, rhythm, and sentence architecture toward the lens. Fixing only spelling, capitalization, or punctuation is a FAILURE. Keep the writer's content, ideas, and facts (what happens, who is there, every detail they invented); transform HOW it is said. You are editing their material through this voice, never inventing new plot or replacing their ideas.

Return ONLY the edited text. Then on a new line write "DIGBY NUDGE:" followed by ONE short, encouraging sentence (no dashes) naming one thing the writer could push further themselves. No other preamble or explanation.

TEXT:
"""${text}"""`.trim();
};

/* ─────────── CORS */
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

/* Strip em/en dashes everywhere EXCEPT gonzo (whose voice is built on them). */
const scrubDashes = s => s.replace(/\s*[—–]\s*/g, ', ').replace(/ ,/g, ',');

export default {
  async fetch(req, env) {
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

    const {
      text = '',
      style = 'lish',
      intensity = 'medium',
      customVoice = ''
    } = body || {};

    if (!text.trim()) return json({ error: 'Empty text.' }, 400);
    if (style === 'custom' && !customVoice.trim()) {
      return json({ error: 'Describe a voice for custom mode.' }, 400);
    }

    const prompt = buildPrompt({ text, style, intensity, customVoice });

    try {
      // Qwen3-30B-A3B: free-tier MoE instruct, newer/stronger writer than
      // Llama 3.3 70B. It's a reasoning model, so we force thinking OFF with
      // /no_think and strip any <think> block defensively, dodging the
      // token-burn/empty-output trap that killed gpt-oss and v4-pro.
      const r = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1800
      });

      // Standard Workers AI shape is { response: "..." }; OpenAI-shape fallback.
      let raw = (r?.response || r?.choices?.[0]?.message?.content || '').trim();
      raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Split the editor's nudge off the edited text.
      let note = '';
      const parts = raw.split(/DIGBY NUDGE:/i);
      let out = parts[0].trim();
      // Strip surrounding quotes and any markdown emphasis (*foo*, _foo_).
      if (parts[1]) note = parts[1].trim().replace(/^["']|["']$/g, '').replace(/[*_]/g, '');

      if (out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1).trim();

      // Dash rule: scrub edited text everywhere except gonzo; always scrub the nudge.
      if (style !== 'gonzo') out = scrubDashes(out);
      note = scrubDashes(note);

      const fluff = Math.max(
        0,
        Math.round(((text.length - out.length) / text.length) * 100)
      );

      return json({ transformedText: out, fluff, note });
    } catch (err) {
      console.error(err);
      return json({ error: 'Server error.' }, 500);
    }
  }
};
