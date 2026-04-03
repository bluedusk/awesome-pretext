// Web search source: uses Google Custom Search API or SerpAPI
// Falls back to GitHub code search if no API key is set

export async function searchWeb(queries, config) {
  const results = [];
  const seen = new Set();

  // Try Google Custom Search API
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCseId = process.env.GOOGLE_CSE_ID;

  // Try SerpAPI as alternative
  const serpApiKey = process.env.SERPAPI_KEY;

  if (googleApiKey && googleCseId) {
    return searchGoogle(queries, googleApiKey, googleCseId, seen);
  } else if (serpApiKey) {
    return searchSerpApi(queries, serpApiKey, seen);
  } else {
    console.log('No web search API key set (GOOGLE_API_KEY+GOOGLE_CSE_ID or SERPAPI_KEY). Skipping web search.');
    console.log('To enable: set GOOGLE_API_KEY + GOOGLE_CSE_ID, or SERPAPI_KEY as environment variables.');
    return results;
  }
}

async function searchGoogle(queries, apiKey, cseId, seen) {
  const results = [];

  for (const query of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=10`;
      const res = await fetch(url);
      const data = await res.json();

      for (const item of data.items || []) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);

        results.push({
          source: 'google',
          type: classifyUrl(item.link),
          url: item.link,
          title: item.title,
          description: item.snippet || '',
          search_rank: results.length + 1,
          search_query: query,
          raw: item,
        });
      }
    } catch (e) {
      console.error(`Google search failed for "${query}": ${e.message}`);
    }
  }

  return results;
}

async function searchSerpApi(queries, apiKey, seen) {
  const results = [];

  for (const query of queries) {
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=10`;
      const res = await fetch(url);
      const data = await res.json();

      for (const item of data.organic_results || []) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);

        results.push({
          source: 'serpapi',
          type: classifyUrl(item.link),
          url: item.link,
          title: item.title,
          description: item.snippet || '',
          search_rank: item.position || 0,
          search_query: query,
          raw: item,
        });
      }
    } catch (e) {
      console.error(`SerpAPI search failed for "${query}": ${e.message}`);
    }
  }

  return results;
}

function classifyUrl(url) {
  if (url.includes('github.com')) return 'repo';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  if (url.includes('dev.to') || url.includes('medium.com') || url.includes('hackernoon.com')) return 'article';
  if (url.includes('udemy.com') || url.includes('coursera.org') || url.includes('egghead.io')) return 'course';
  return 'article';
}
