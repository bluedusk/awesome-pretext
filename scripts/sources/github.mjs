// GitHub source: search repos, fetch metadata, evaluate activity
import { execSync } from 'child_process';

export async function searchGitHub(queries, config) {
  const results = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const raw = execSync(
        `gh search repos "${query}" --sort stars --limit ${config.max_results_per_source} --json fullName,description,stargazersCount,url,updatedAt`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      const repos = JSON.parse(raw);

      for (const repo of repos) {
        if (seen.has(repo.fullName)) continue;
        if (config.excluded_repos.includes(repo.fullName)) continue;
        seen.add(repo.fullName);

        // Check if actually related to @chenglou/pretext
        const desc = (repo.description || '').toLowerCase();
        const name = repo.fullName.toLowerCase();
        const isRelevant =
          desc.includes('pretext') ||
          desc.includes('chenglou') ||
          desc.includes('dom-free') ||
          desc.includes('text layout') ||
          name.includes('pretext');

        if (!isRelevant) continue;

        results.push({
          source: 'github',
          type: 'repo',
          url: repo.url,
          title: repo.fullName,
          description: repo.description || '',
          stars: repo.stargazersCount,
          updated_at: repo.updatedAt,
          raw: repo,
        });
      }
    } catch (e) {
      console.error(`GitHub search failed for "${query}": ${e.message}`);
    }
  }

  return results;
}

export async function enrichRepo(repoFullName) {
  try {
    const raw = execSync(
      `gh api repos/${repoFullName} --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count, watchers: .subscribers_count, created_at: .created_at, updated_at: .updated_at, pushed_at: .pushed_at, topics: .topics, license: .license.spdx_id, has_wiki: .has_wiki, homepage: .homepage, language: .language, size: .size}'`,
      { encoding: 'utf-8', timeout: 15000 }
    );
    const data = JSON.parse(raw);

    // Get recent commit count (last 30 days)
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    let recentCommits = 0;
    try {
      const commitsRaw = execSync(
        `gh api "repos/${repoFullName}/commits?since=${since}&per_page=1" -i 2>&1 | head -20`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      // Parse Link header for total count approximation
      const match = commitsRaw.match(/page=(\d+)>; rel="last"/);
      recentCommits = match ? parseInt(match[1]) : 1;
    } catch {}

    // Get contributor count
    let contributors = 0;
    try {
      const contribRaw = execSync(
        `gh api "repos/${repoFullName}/contributors?per_page=1" -i 2>&1 | head -20`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      const match = contribRaw.match(/page=(\d+)>; rel="last"/);
      contributors = match ? parseInt(match[1]) : 1;
    } catch {}

    return {
      ...data,
      recent_commits_30d: recentCommits,
      contributors,
    };
  } catch (e) {
    console.error(`Failed to enrich ${repoFullName}: ${e.message}`);
    return null;
  }
}
