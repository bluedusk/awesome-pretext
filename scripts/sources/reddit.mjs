// Reddit source: search via public JSON API (no auth needed)

export async function searchReddit(queries) {
  const results = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=25`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'awesome-pretext-bot/1.0' },
      });

      if (!res.ok) {
        console.error(`Reddit search returned ${res.status} for "${query}"`);
        continue;
      }

      const data = await res.json();

      for (const child of data.data?.children || []) {
        const post = child.data;
        if (seen.has(post.id)) continue;
        seen.add(post.id);

        // Filter: must mention pretext
        const title = (post.title || '').toLowerCase();
        const text = (post.selftext || '').toLowerCase();
        if (!title.includes('pretext') && !text.includes('pretext')) continue;

        results.push({
          source: 'reddit',
          type: 'discussion',
          url: post.url,
          reddit_url: `https://reddit.com${post.permalink}`,
          title: post.title,
          description: (post.selftext || '').slice(0, 300),
          points: post.score || 0,
          comments: post.num_comments || 0,
          subreddit: post.subreddit,
          author: post.author,
          created_at: new Date(post.created_utc * 1000).toISOString(),
          raw: post,
        });
      }
    } catch (e) {
      console.error(`Reddit search failed for "${query}": ${e.message}`);
    }
  }

  return results;
}
