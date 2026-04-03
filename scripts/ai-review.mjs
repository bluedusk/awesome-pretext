// AI-assisted review: uses Claude API to evaluate content quality
// and generate PR descriptions

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Use Claude to evaluate a batch of links for quality and relevance.
 * Returns AI assessments for each link.
 */
export async function aiEvaluateLinks(links) {
  if (!ANTHROPIC_API_KEY) {
    console.log('No ANTHROPIC_API_KEY set. Skipping AI evaluation.');
    return links.map((l) => ({ ...l, ai_review: null }));
  }

  // Batch links into groups of 20 to stay within context limits
  const batches = [];
  for (let i = 0; i < links.length; i += 20) {
    batches.push(links.slice(i, i + 20));
  }

  const results = [];
  for (const batch of batches) {
    const reviewed = await evaluateBatch(batch);
    results.push(...reviewed);
  }

  return results;
}

async function evaluateBatch(links) {
  const linksStr = links
    .map(
      (l, i) =>
        `[${i}] ${l.title}\n    URL: ${l.url}\n    Description: ${l.description}\n    Source: ${l.source}\n    Score: ${l.evaluation?.composite || 'N/A'}\n    Category: ${l.category || 'unknown'}`
    )
    .join('\n\n');

  const prompt = `You are evaluating links for an "awesome-pretext" list — a curated collection of resources for @chenglou/pretext, the DOM-free text layout engine.

For each link below, provide:
1. **relevant**: true/false — Is this actually about chenglou's Pretext library (NOT PreTeXtBook for math authoring, NOT phishing pretexts, NOT ML pretext tasks)?
2. **quality**: 1-10 — How valuable is this for developers learning/using Pretext?
3. **category**: one of [demo, community-project, tutorial, article, course, video, tool]
4. **summary**: 1 sentence describing what this is and why it's valuable (or not)
5. **include**: true/false — Should this be in the awesome list?

Links to evaluate:

${linksStr}

Respond with a JSON array of objects, one per link, in the same order. Use the index numbers to match.
Return ONLY the JSON array, no other text.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const reviews = JSON.parse(jsonStr);

    return links.map((link, i) => ({
      ...link,
      ai_review: reviews[i] || null,
    }));
  } catch (e) {
    console.error(`AI evaluation failed: ${e.message}`);
    return links.map((l) => ({ ...l, ai_review: null }));
  }
}

/**
 * Generate a PR description summarizing the proposed changes.
 */
export async function generatePRDescription(added, updated, removed) {
  if (!ANTHROPIC_API_KEY) {
    return generateFallbackPR(added, updated, removed);
  }

  const prompt = `Generate a concise PR description for updating the awesome-pretext list.

Changes:
- Added ${added.length} new links: ${added.map((l) => l.title).join(', ')}
- Updated ${updated.length} existing links
- Removed ${removed.length} links (stale/irrelevant)

Format as GitHub PR markdown with:
## Summary (2-3 bullets)
## New Additions (table with title, category, score)
## Updates (brief list)
## Removals (brief list with reason)

Keep it concise. Return only the markdown.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    return data.content?.[0]?.text || generateFallbackPR(added, updated, removed);
  } catch (e) {
    return generateFallbackPR(added, updated, removed);
  }
}

function generateFallbackPR(added, updated, removed) {
  const lines = ['## Automated Update\n'];

  if (added.length > 0) {
    lines.push(`### New Additions (${added.length})\n`);
    lines.push('| Title | Category | Score |');
    lines.push('|-------|----------|-------|');
    for (const l of added) {
      lines.push(`| [${l.title}](${l.url}) | ${l.category || '?'} | ${l.evaluation?.composite || '?'} |`);
    }
    lines.push('');
  }

  if (updated.length > 0) {
    lines.push(`### Updated (${updated.length})\n`);
    for (const l of updated) lines.push(`- ${l.title}: score updated`);
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push(`### Removed (${removed.length})\n`);
    for (const l of removed) lines.push(`- ${l.title}: ${l.removal_reason || 'stale'}`);
    lines.push('');
  }

  return lines.join('\n');
}
