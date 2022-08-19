import fetch from 'node-fetch'

export default async function fetchURL<Data>(url: string): Promise<Data> {
  const res = await fetch(url)
  return await res.json()
}
