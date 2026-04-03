#!/usr/bin/env node

// Main orchestrator: collect → evaluate → review → generate → PR
//
// Usage:
//   node scripts/update.mjs              # Dry run (no PR)
//   node scripts/update.mjs --create-pr  # Create PR with changes
//   node scripts/update.mjs --collect-only  # Just collect and save data

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { searchGitHub } from './sources/github.mjs';
import { searchHackerNews } from './sources/hackernews.mjs';
import { searchReddit } from './sources/reddit.mjs';
import { searchWeb } from './sources/web.mjs';
import { evaluateLink, categorizeLink } from './evaluate.mjs';
import { aiEvaluateLinks, generatePRDescription } from './ai-review.mjs';
import { generateReadme } from './generate.mjs';

const CONFIG_PATH = 'data/config.json';
const LINKS_PATH = 'data/links.json';
const README_PATH = 'README.md';

const args = process.argv.slice(2);
const createPR = args.includes('--create-pr');
const collectOnly = args.includes('--collect-only');

async function main() {
  console.log('=== Awesome Pretext Auto-Update ===\n');

  // Load config and existing data
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const existing = JSON.parse(readFileSync(LINKS_PATH, 'utf-8'));
  const existingUrls = new Set(existing.links.map((l) => l.url));

  // ── Step 1: Collect from all sources ──
  console.log('Step 1: Collecting links from all sources...\n');

  const [githubResults, hnResults, redditResults, webResults] = await Promise.all([
    searchGitHub(config.search_queries.github, config).then((r) => {
      console.log(`  GitHub: ${r.length} results`);
      return r;
    }),
    searchHackerNews(config.search_queries.hackernews).then((r) => {
      console.log(`  Hacker News: ${r.length} results`);
      return r;
    }),
    searchReddit(config.search_queries.reddit).then((r) => {
      console.log(`  Reddit: ${r.length} results`);
      return r;
    }),
    searchWeb(config.search_queries.web, config).then((r) => {
      console.log(`  Web search: ${r.length} results`);
      return r;
    }),
  ]);

  const allResults = [...githubResults, ...hnResults, ...redditResults, ...webResults];
  console.log(`\n  Total collected: ${allResults.length} raw results`);

  // Deduplicate by URL
  const deduped = [];
  const seenUrls = new Set();
  for (const r of allResults) {
    const normalizedUrl = r.url.replace(/\/$/, '').toLowerCase();
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    deduped.push(r);
  }
  console.log(`  After dedup: ${deduped.length} unique results\n`);

  // ── Step 2: Evaluate each link ──
  console.log('Step 2: Evaluating links...\n');

  for (const link of deduped) {
    link.category = categorizeLink(link);
    link.evaluation = await evaluateLink(link, config);
    const status =
      link.evaluation.decision === 'include'
        ? '✓'
        : link.evaluation.decision === 'review'
          ? '?'
          : '✗';
    console.log(
      `  ${status} [${link.evaluation.composite.toFixed(1)}] ${link.title.slice(0, 50)} (${link.category})`
    );
  }

  // ── Step 3: AI review (if API key available) ──
  console.log('\nStep 3: AI review...\n');

  const candidates = deduped.filter(
    (l) => l.evaluation.decision === 'include' || l.evaluation.decision === 'review'
  );
  console.log(`  ${candidates.length} candidates for AI review`);

  const reviewed = await aiEvaluateLinks(candidates);

  // Apply AI adjustments
  for (const link of reviewed) {
    if (link.ai_review) {
      // AI can override the decision
      if (link.ai_review.relevant === false) {
        link.evaluation.decision = 'skip';
        link.evaluation.ai_override = 'not relevant per AI';
      } else if (link.ai_review.include === true && link.evaluation.decision === 'review') {
        link.evaluation.decision = 'include';
        link.evaluation.ai_override = 'promoted by AI';
      }
      if (link.ai_review.category) {
        link.category = link.ai_review.category;
      }
      if (link.ai_review.summary) {
        link.ai_summary = link.ai_review.summary;
      }
    }
  }

  // ── Step 4: Determine changes ──
  console.log('\nStep 4: Determining changes...\n');

  const toInclude = reviewed.filter((l) => l.evaluation.decision === 'include');
  const newLinks = toInclude.filter((l) => !existingUrls.has(l.url));
  const updatedLinks = toInclude.filter((l) => existingUrls.has(l.url));

  // Check for stale existing links
  const staleLinks = [];
  for (const existingLink of existing.links) {
    if (existingLink.evaluation?.scores?.freshness <= 2) {
      staleLinks.push({ ...existingLink, removal_reason: 'stale — no activity' });
    }
  }

  console.log(`  New links to add: ${newLinks.length}`);
  console.log(`  Links to update: ${updatedLinks.length}`);
  console.log(`  Stale links to flag: ${staleLinks.length}`);

  // ── Step 5: Save data ──
  console.log('\nStep 5: Saving data...\n');

  // Merge new links with existing, updating scores for known URLs
  const mergedLinks = [...existing.links];
  for (const link of toInclude) {
    const idx = mergedLinks.findIndex((l) => l.url === link.url);
    if (idx >= 0) {
      mergedLinks[idx] = { ...mergedLinks[idx], ...link, last_checked: new Date().toISOString() };
    } else {
      mergedLinks.push({ ...link, added_at: new Date().toISOString(), last_checked: new Date().toISOString() });
    }
  }

  const updatedData = {
    last_updated: new Date().toISOString(),
    links: mergedLinks,
  };

  writeFileSync(LINKS_PATH, JSON.stringify(updatedData, null, 2));
  console.log(`  Saved ${mergedLinks.length} links to ${LINKS_PATH}`);

  if (collectOnly) {
    console.log('\n  --collect-only mode. Stopping here.');
    return;
  }

  // ── Step 6: Generate updated README ──
  console.log('\nStep 6: Generating README...\n');

  const existingReadme = readFileSync(README_PATH, 'utf-8');
  const updatedReadme = generateReadme(mergedLinks, existingReadme);
  writeFileSync(README_PATH, updatedReadme);
  console.log('  README.md updated');

  // ── Step 7: Create PR ──
  if (createPR && (newLinks.length > 0 || staleLinks.length > 0)) {
    console.log('\nStep 7: Creating PR...\n');

    const branchName = `auto-update/${new Date().toISOString().split('T')[0]}`;
    const prBody = await generatePRDescription(newLinks, updatedLinks, staleLinks);

    try {
      execSync(`git checkout -b "${branchName}"`, { stdio: 'pipe' });
      execSync('git add -A', { stdio: 'pipe' });
      execSync(
        `git commit -m "chore: auto-update awesome list (${newLinks.length} new, ${updatedLinks.length} updated)"`,
        { stdio: 'pipe' }
      );
      execSync(`git push -u origin "${branchName}"`, { stdio: 'pipe' });

      const prTitle = `Auto-update: ${newLinks.length} new links, ${updatedLinks.length} updates`;
      execSync(
        `gh pr create --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}" --label "automated"`,
        { stdio: 'pipe' }
      );
      console.log(`  PR created on branch ${branchName}`);
    } catch (e) {
      console.error(`  PR creation failed: ${e.message}`);
    }
  } else if (createPR) {
    console.log('\nNo changes to PR.');
  }

  // ── Summary ──
  console.log('\n=== Summary ===');
  console.log(`Total links in database: ${mergedLinks.length}`);
  console.log(`New: ${newLinks.length} | Updated: ${updatedLinks.length} | Stale: ${staleLinks.length}`);
  console.log(
    `By category: ${Object.entries(
      mergedLinks.reduce((acc, l) => {
        acc[l.category || '?'] = (acc[l.category || '?'] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([k, v]) => `${k}(${v})`)
      .join(' ')}`
  );
  console.log(`Score range: ${Math.min(...mergedLinks.map((l) => l.evaluation?.composite || 0)).toFixed(1)} - ${Math.max(...mergedLinks.map((l) => l.evaluation?.composite || 0)).toFixed(1)}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
