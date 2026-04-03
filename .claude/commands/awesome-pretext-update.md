You are maintaining the **awesome-pretext** repo — a curated list of demos, projects, tutorials, articles, and news for [@chenglou/pretext](https://github.com/chenglou/pretext), the DOM-free text layout engine.

Your job: find new valuable content, evaluate it, update the README, and create a PR for review.

## Step 1: Collect

Search all these sources for Pretext-related content. Cast a wide net.

### GitHub
Run these searches via `gh search repos`:
- `pretext chenglou`
- `pretext text layout`
- `pretext canvas DOM-free`
- `pretext demo`
- `pretext game`

For each repo found, get: stars, last commit, description, topics. Skip repos that are about PreTeXtBook (math authoring), phishing pretexts, or ML pretext tasks.

### Web Search
Use your WebSearch tool to search for:
- `chenglou pretext demo 2026`
- `pretext text layout tutorial`
- `@chenglou/pretext guide`
- `pretext DOM-free course`
- `pretext chenglou blog post`
- `pretext text layout news`

### Hacker News
Use WebFetch on `https://hn.algolia.com/api/v1/search?query=pretext+chenglou&tags=story&hitsPerPage=30` to find discussions.

### Reddit
Use WebFetch on `https://www.reddit.com/search.json?q=chenglou+pretext&sort=relevance&limit=25` (set User-Agent header).

### X / Twitter
Use WebSearch to search for: `site:x.com chenglou pretext` and `site:twitter.com pretext text layout`

## Step 2: Evaluate

For each link found, score it on these dimensions (0-10):

| Dimension | Weight | What to check |
|-----------|--------|---------------|
| **Relevance** | 25% | Is this actually about @chenglou/pretext? (NOT PreTeXtBook, NOT phishing, NOT ML) |
| **Popularity** | 20% | GitHub stars, HN points, Reddit upvotes, social shares |
| **Freshness** | 20% | When was it last updated/published? Prefer recent content |
| **Activity** | 15% | For repos: recent commits, open issues, PRs. For articles: comments, engagement |
| **Quality** | 15% | Depth of content, working demo, good README, originality |
| **Authority** | 5% | Author credibility, site reputation |

Calculate composite score = weighted average.

**Decisions:**
- Score >= 7.0 → Include (add to README)
- Score 4.0-6.9 → Flag for review (mention in PR description)
- Score < 4.0 → Skip

## Step 3: Compare with existing

Read the current `README.md` and `data/links.json`.
- Identify **new links** not already in the README
- Identify **stale links** (repos with no activity in 6+ months, broken URLs)
- Identify **score changes** (repo gained/lost significant stars)

## Step 4: Update

If there are changes worth making:

1. Read and update `data/links.json` with all scored links and metadata
2. Update `README.md`:
   - Add new high-scoring items to the appropriate section
   - Update star counts in the Community Projects table
   - Add emerging content to the auto-populated sections (between `<!-- *_AUTO_START -->` and `<!-- *_AUTO_END -->` tags)
   - Flag stale items for removal
3. Update the `Last auto-updated:` date

### Section mapping:
- GitHub repos with demos/games → **Demos** section
- GitHub repos that are tools/libraries → **Community Projects** section
- Blog posts, articles → **Articles & Blog Posts** section
- How-to guides, getting started → **Tutorials** section
- Video content → **Videos & Talks** section
- Courses → **Tutorials** (courses subsection)

## Step 5: Create PR

Create a new branch `auto-update/YYYY-MM-DD` and open a PR with:
- Title: `Auto-update: X new links, Y updates`
- Body: summary of what was found, table of new links with scores, any stale links flagged

## Rules

- **Quality over quantity** — only include genuinely valuable content
- **No duplicates** — check before adding
- **Accurate descriptions** — read the actual content before writing a summary
- **Correct categories** — demos are demos, articles are articles
- **Preserve hand-written content** — only modify auto-populated sections and add new entries; don't rewrite existing entries
- **Be conservative** — when unsure, flag for review rather than auto-including
