// Hacker News source: search via Algolia API (free, no auth)

export async function searchHackerNews(queries) {
  const results = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`;
      const res = await fetch(url);
      const data = await res.json();

      for (const hit of data.hits || []) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);

        // Filter: must mention pretext in title or URL
        const title = (hit.title || '').toLowerCase();
        const storyUrl = (hit.url || '').toLowerCase();
        if (!title.includes('pretext') && !storyUrl.includes('pretext')) continue;

        results.push({
          source: 'hackernews',
          type: 'discussion',
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          hn_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: hit.title,
          description: '',
          points: hit.points || 0,
          comments: hit.num_comments || 0,
          author: hit.author,
          created_at: hit.created_at,
          raw: hit,
        });
      }
    } catch (e) {
      console.error(`HN search failed for "${query}": ${e.message}`);
    }
  }

  return results;
}
