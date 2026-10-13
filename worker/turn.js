// Cloudflare Worker: hands the game short-lived TURN credentials so phones on other networks
// (cellular, strict routers) can still reach the TV through Cloudflare's relay.
// The API token lives only here, as a Worker secret. Deploy steps are in README.md.

const ALLOWED = [/^https:\/\/bropacman\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const TTL = 86400; // a day: longer than any game night, short enough that a leaked one soon dies

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = ALLOWED.some(re => re.test(origin))
      ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
      : null;
    if (!cors) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });

    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL })
    });
    if (!res.ok) return new Response('TURN unavailable', { status: 502, headers: cors });
    const { iceServers } = await res.json();
    // browsers block port 53, and trying it just slows the connection down
    const servers = [].concat(iceServers).map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) }));
    return Response.json({ iceServers: servers }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
  }
};
