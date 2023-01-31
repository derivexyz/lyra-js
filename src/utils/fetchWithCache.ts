import fetch from 'cross-fetch'

const CACHE: Record<string, { lastUpdated: number; fetch: Promise<any> }> = {}
const CACHE_TIMEOUT = 5 * 1000

const fetcher = async (url: string): Promise<any> => {
  const data = await fetch(url)
  return await data.json()
}

export default async function fetchWithCache(url: string) {
  const now = Date.now()
  if (!CACHE[url] || now > CACHE[url].lastUpdated + CACHE_TIMEOUT) {
    CACHE[url] = {
      fetch: fetcher(url),
      lastUpdated: now,
    }
  }
  return CACHE[url].fetch
}
