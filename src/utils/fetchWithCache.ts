import fetch from 'cross-fetch'

const CACHE: Record<string, { lastUpdated: number; fetch: Promise<any> }> = {}
const CACHE_TIMEOUT = 5 * 1000

async function fetcher<T>(url: string): Promise<T> {
  const data = await fetch(url)
  return await data.json()
}

export default async function fetchWithCache<T>(url: string): Promise<T> {
  const now = Date.now()
  if (!CACHE[url] || now > CACHE[url].lastUpdated + CACHE_TIMEOUT) {
    CACHE[url] = {
      fetch: fetcher<T>(url),
      lastUpdated: now,
    }
  }
  return CACHE[url].fetch
}
