// Evaluation engine: scores links on multiple dimensions

import { enrichRepo } from './sources/github.mjs';

/**
 * Score a link on 6 dimensions (0-10 each), return composite score.
 *
 * Dimensions:
 *   relevance  - Is this actually about @chenglou/pretext?
 *   popularity - Stars, upvotes, shares, growth rate
 *   freshness  - How recent? Decays over time
 *   activity   - Commits, issues, responses (repos only)
 *   quality    - README, live demo, description depth
 *   authority  - Author credibility, site reputation
 */
export async function evaluateLink(link, config) {
  const scores = {
    relevance: scoreRelevance(link),
    popularity: scorePopularity(link),
    freshness: scoreFreshness(link, config),
    activity: 5, // default for non-repos
    quality: scoreQuality(link),
    authority: scoreAuthority(link),
  };

  // Enrich GitHub repos with activity data
  if (link.source === 'github' && link.type === 'repo') {
    const repoName = link.title || link.url.replace('https://github.com/', '');
    const enriched = await enrichRepo(repoName);
    if (enriched) {
      link.enriched = enriched;
      scores.activity = scoreActivity(enriched);
      scores.quality = scoreRepoQuality(link, enriched);
      scores.popularity = scoreRepoPopularity(link, enriched);
    }
  }

  // Weighted composite
  const weights = config.scoring_weights;
  const composite =
    scores.relevance * weights.relevance +
    scores.popularity * weights.popularity +
    scores.freshness * weights.freshness +
    scores.activity * weights.activity +
    scores.quality * weights.quality +
    scores.authority * weights.authority;

  return {
    scores,
    composite: Math.round(composite * 100) / 100,
    decision: composite >= config.thresholds.auto_include
      ? 'include'
      : composite >= config.thresholds.suggest_review
        ? 'review'
        : 'skip',
  };
}

// ── Scoring functions ──

function scoreRelevance(link) {
  const text = `${link.title} ${link.description}`.toLowerCase();
  let score = 0;

  // Strong signals
  if (text.includes('@chenglou/pretext')) score += 4;
  if (text.includes('chenglou') && text.includes('pretext')) score += 3;
  if (text.includes('dom-free') && text.includes('text')) score += 2;

  // Medium signals
  if (text.includes('pretext')) score += 2;
  if (text.includes('text layout') && text.includes('canvas')) score += 2;
  if (text.includes('text measurement')) score += 1;
  if (text.includes('prepare()') || text.includes('layout()')) score += 2;

  // Weak signals (might be different "pretext")
  if (text.includes('pretextbook') || text.includes('pretext authoring')) score -= 5;
  if (text.includes('phishing') || text.includes('social engineering')) score -= 5;
  if (text.includes('self-supervised') || text.includes('pretext task')) score -= 5;

  return Math.max(0, Math.min(10, score));
}

function scorePopularity(link) {
  // For HN/Reddit posts
  const points = link.points || 0;
  const comments = link.comments || 0;

  if (link.source === 'hackernews') {
    if (points > 500) return 10;
    if (points > 200) return 9;
    if (points > 100) return 8;
    if (points > 50) return 7;
    if (points > 20) return 6;
    if (points > 10) return 5;
    return Math.min(4, Math.ceil(points / 3));
  }

  if (link.source === 'reddit') {
    if (points > 1000) return 10;
    if (points > 500) return 8;
    if (points > 100) return 7;
    if (points > 50) return 6;
    if (points > 10) return 5;
    return 3;
  }

  // For web results, search rank is a proxy
  if (link.search_rank) {
    return Math.max(1, 10 - link.search_rank);
  }

  return 5; // default
}

function scoreRepoPopularity(link, enriched) {
  const stars = enriched.stars || link.stars || 0;
  if (stars > 10000) return 10;
  if (stars > 1000) return 9;
  if (stars > 500) return 8;
  if (stars > 100) return 7;
  if (stars > 50) return 6;
  if (stars > 20) return 5;
  if (stars > 10) return 4;
  if (stars > 5) return 3;
  return 2;
}

function scoreFreshness(link, config) {
  const dateStr = link.updated_at || link.created_at;
  if (!dateStr) return 5;

  const age = (Date.now() - new Date(dateStr).getTime()) / 86400000; // days
  const decay = config.freshness_decay_days || 180;

  if (age < 7) return 10;
  if (age < 30) return 9;
  if (age < 60) return 8;
  if (age < 90) return 7;
  if (age < decay) return 6;
  if (age < decay * 2) return 4;
  if (age < decay * 4) return 2;
  return 1;
}

function scoreActivity(enriched) {
  let score = 0;

  // Recent commits
  const commits = enriched.recent_commits_30d || 0;
  if (commits > 20) score += 4;
  else if (commits > 5) score += 3;
  else if (commits > 1) score += 2;
  else if (commits > 0) score += 1;

  // Contributors
  const contribs = enriched.contributors || 0;
  if (contribs > 10) score += 2;
  else if (contribs > 3) score += 1.5;
  else if (contribs > 1) score += 1;

  // Issue activity (open issues as sign of engagement, not neglect)
  const issues = enriched.open_issues || 0;
  if (issues > 0 && issues < 50) score += 1;
  if (issues >= 50) score += 0.5; // too many might mean neglected

  // Pushed recently
  if (enriched.pushed_at) {
    const daysSincePush = (Date.now() - new Date(enriched.pushed_at).getTime()) / 86400000;
    if (daysSincePush < 7) score += 3;
    else if (daysSincePush < 30) score += 2;
    else if (daysSincePush < 90) score += 1;
  }

  return Math.min(10, score);
}

function scoreQuality(link) {
  let score = 5; // baseline

  // Has description
  if (link.description && link.description.length > 50) score += 1;
  if (link.description && link.description.length > 150) score += 1;

  // Has live demo URL
  if (link.url && !link.url.includes('github.com')) score += 1;

  return Math.min(10, score);
}

function scoreRepoQuality(link, enriched) {
  let score = 3;

  // Has description
  if (link.description && link.description.length > 20) score += 1;
  if (link.description && link.description.length > 80) score += 1;

  // Has homepage/demo
  if (enriched.homepage) score += 2;

  // Has license
  if (enriched.license) score += 1;

  // Has topics/tags
  if (enriched.topics && enriched.topics.length > 0) score += 1;

  // Non-trivial size
  if (enriched.size > 100) score += 1;

  return Math.min(10, score);
}

function scoreAuthority(link) {
  const url = link.url || '';

  // Known high-authority domains
  if (url.includes('chenglou.me')) return 10;
  if (url.includes('github.com/chenglou')) return 10;
  if (url.includes('venturebeat.com')) return 8;
  if (url.includes('hackernoon.com')) return 7;
  if (url.includes('medium.com')) return 6;
  if (url.includes('dev.to')) return 6;
  if (url.includes('simonwillison.net')) return 8;
  if (url.includes('news.ycombinator.com')) return 8;

  // GitHub repos by known authors
  if (url.includes('github.com')) return 5;

  return 4; // unknown
}

/**
 * Categorize a link into one of the defined categories.
 */
export function categorizeLink(link) {
  const url = (link.url || '').toLowerCase();
  const title = (link.title || '').toLowerCase();
  const desc = (link.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  if (url.includes('github.com') && link.source === 'github') {
    // Check if it's a demo or a project
    if (text.includes('demo') || text.includes('experiment') || text.includes('game') || text.includes('animation')) {
      return 'demo';
    }
    return 'community-project';
  }

  if (text.includes('tutorial') || text.includes('how to') || text.includes('getting started') || text.includes('guide')) {
    return 'tutorial';
  }

  if (text.includes('course') || url.includes('udemy') || url.includes('coursera') || url.includes('egghead')) {
    return 'course';
  }

  if (url.includes('youtube.com') || url.includes('youtu.be') || text.includes('video') || text.includes('talk')) {
    return 'video';
  }

  if (link.source === 'hackernews' || link.source === 'reddit') {
    return 'article';
  }

  return 'article';
}
