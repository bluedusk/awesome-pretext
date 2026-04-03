// README generator: produces README.md from scored link data
import { readFileSync } from 'fs';

/**
 * Generate the full README.md content from scored links and existing template sections.
 */
export function generateReadme(links, existingReadme) {
  // Parse existing README to preserve hand-written sections
  const sections = parseExistingReadme(existingReadme);

  // Group links by category
  const grouped = {};
  for (const link of links) {
    const cat = link.category || 'article';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(link);
  }

  // Sort each group by composite score descending
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (b.evaluation?.composite || 0) - (a.evaluation?.composite || 0));
  }

  // Build the dynamic sections
  const demoTable = buildDemoTable(grouped['demo'] || []);
  const projectTable = buildProjectTable(grouped['community-project'] || []);
  const articleList = buildArticleList(grouped['article'] || []);
  const tutorialList = buildTutorialList(grouped['tutorial'] || []);
  const videoList = buildVideoList(grouped['video'] || []);
  const courseList = buildCourseList(grouped['course'] || []);

  // Replace dynamic sections in the README while keeping static content
  let readme = existingReadme;

  // Update demo tables (between <!-- DEMOS_START --> and <!-- DEMOS_END -->)
  readme = replaceSection(readme, 'DEMOS_AUTO', demoTable);
  readme = replaceSection(readme, 'PROJECTS_AUTO', projectTable);
  readme = replaceSection(readme, 'ARTICLES_AUTO', articleList);
  readme = replaceSection(readme, 'TUTORIALS_AUTO', tutorialList);
  readme = replaceSection(readme, 'VIDEOS_AUTO', videoList);
  readme = replaceSection(readme, 'COURSES_AUTO', courseList);

  // Update timestamp
  const now = new Date().toISOString().split('T')[0];
  readme = readme.replace(
    /Last auto-updated: \d{4}-\d{2}-\d{2}/,
    `Last auto-updated: ${now}`
  );

  return readme;
}

function replaceSection(readme, tag, content) {
  const startTag = `<!-- ${tag}_START -->`;
  const endTag = `<!-- ${tag}_END -->`;
  const startIdx = readme.indexOf(startTag);
  const endIdx = readme.indexOf(endTag);

  if (startIdx === -1 || endIdx === -1) {
    // Tags don't exist yet — skip
    return readme;
  }

  return (
    readme.slice(0, startIdx + startTag.length) +
    '\n' +
    content +
    '\n' +
    readme.slice(endIdx)
  );
}

function buildDemoTable(demos) {
  if (demos.length === 0) return '*No new demos found this cycle.*';

  const lines = [
    '| Demo | Description | Score |',
    '|------|-------------|-------|',
  ];

  for (const d of demos) {
    const name = d.title.includes('/') ? d.title.split('/')[1] : d.title;
    const score = d.evaluation?.composite?.toFixed(1) || '?';
    const desc = (d.description || '').slice(0, 100);
    lines.push(`| [${name}](${d.url}) | ${desc} | ${score} |`);
  }

  return lines.join('\n');
}

function buildProjectTable(projects) {
  if (projects.length === 0) return '*No new projects found this cycle.*';

  const lines = [
    '| Project | Stars | Last Commit | Score | Description |',
    '|---------|-------|-------------|-------|-------------|',
  ];

  for (const p of projects) {
    const name = p.title.includes('/') ? p.title.split('/')[1] : p.title;
    const stars = p.enriched?.stars || p.stars || '?';
    const score = p.evaluation?.composite?.toFixed(1) || '?';
    const desc = (p.description || '').slice(0, 80);
    const lastCommit = `![](https://img.shields.io/github/last-commit/${p.title}?style=flat-square)`;
    lines.push(`| [${name}](${p.url}) | ${stars} | ${lastCommit} | ${score} | ${desc} |`);
  }

  return lines.join('\n');
}

function buildArticleList(articles) {
  if (articles.length === 0) return '*No new articles found this cycle.*';

  return articles
    .map((a) => {
      const score = a.evaluation?.composite?.toFixed(1) || '?';
      const source = a.source === 'hackernews' ? ' (HN)' : a.source === 'reddit' ? ' (Reddit)' : '';
      return `- [${a.title}](${a.url})${source} — ${(a.description || '').slice(0, 120)} *(score: ${score})*`;
    })
    .join('\n');
}

function buildTutorialList(tutorials) {
  if (tutorials.length === 0) return '*No new tutorials found this cycle.*';

  return tutorials
    .map((t) => {
      const score = t.evaluation?.composite?.toFixed(1) || '?';
      return `- [${t.title}](${t.url}) — ${(t.description || '').slice(0, 120)} *(score: ${score})*`;
    })
    .join('\n');
}

function buildVideoList(videos) {
  if (videos.length === 0) return '*No new videos found this cycle.*';

  return videos
    .map((v) => {
      const score = v.evaluation?.composite?.toFixed(1) || '?';
      return `- [${v.title}](${v.url}) — ${(v.description || '').slice(0, 120)} *(score: ${score})*`;
    })
    .join('\n');
}

function buildCourseList(courses) {
  if (courses.length === 0) return '*No new courses found this cycle.*';

  return courses
    .map((c) => {
      const score = c.evaluation?.composite?.toFixed(1) || '?';
      return `- [${c.title}](${c.url}) — ${(c.description || '').slice(0, 120)} *(score: ${score})*`;
    })
    .join('\n');
}

function parseExistingReadme(readme) {
  // Simple section parser — returns map of heading -> content
  const sections = {};
  const lines = readme.split('\n');
  let currentSection = 'header';
  sections[currentSection] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
      sections[currentSection] = [];
    } else {
      sections[currentSection].push(line);
    }
  }

  return sections;
}
