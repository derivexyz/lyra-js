import fetch from 'node-fetch'

export default async function fetchURL(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    })
    return await res.json()
  } catch (e) {
    return null
  }
}
