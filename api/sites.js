import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const collection = 'jakeweb:sites';
const session = 'jakeweb_admin';
const digest = (value) => createHash('sha256').update(value).digest();
const sign = (message, password) =>
  createHmac('sha256', password).update('jakeweb:session:' + message).digest('hex');

const countAttempt = `
local failures = tonumber(redis.call('GET', KEYS[1]) or '0')
if failures >= 3 then return -1 end
if ARGV[1] == 'yes' then
  redis.call('DEL', KEYS[1])
  return 0
end
return redis.call('INCR', KEYS[1])
`;

export default {
  async fetch(request) {
    const json = (body, status = 200, headers = {}) =>
      Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
    const error = (message, status) => json({ error: message }, status);
    const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token, ADMIN_PASSWORD: password } = process.env;
    const redis = async (...command) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error('Redis request failed');
      const data = await response.json();
      if (data.error) throw new Error('Redis command failed');
      return data.result;
    };

    try {
      if (request.method === 'GET') {
        const rows = url && token ? await redis('HVALS', collection) : [];
        return json(rows.map((row) => JSON.parse(row)).sort((a, b) => a.day - b.day));
      }
      if (request.method !== 'POST') return error('지원하지 않는 요청입니다.', 405);
      if (!url || !token || !password) return error('관리자 설정이 아직 완료되지 않았어요.', 503);
      if (request.headers.get('origin') !== new URL(request.url).origin ||
          request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
        return error('요청을 확인할 수 없어요.', 403);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return error('입력 내용을 확인해 주세요.', 400);
      }

      if (body?.action === 'login') {
        const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim();
        if (!ip) return error('접속 정보를 확인할 수 없어요.', 503);
        const correct = typeof body.password === 'string' && body.password.length <= 1024 &&
          timingSafeEqual(digest(body.password), digest(password));
        const key = 'jakeweb:failures:' + digest(ip).toString('hex');
        const failures = await redis('EVAL', countAttempt, 1, key, correct ? 'yes' : 'no');
        if (failures === -1 || failures >= 3) return error('비밀번호를 3번 틀려 이 접속 주소의 로그인이 잠겼어요.', 429);
        if (failures > 0) return error('비밀번호가 틀렸어요. 남은 시도 ' + (3 - failures) + '회.', 401);
        const expires = String(Date.now() + 900000);
        const value = expires + '.' + sign(expires, password);
        return json({ ok: true }, 200, {
          'Set-Cookie': session + '=' + value + '; Path=/api/sites; Max-Age=900; HttpOnly; Secure; SameSite=Strict'
        });
      }

      const cookie = request.headers.get('cookie')?.split(/;\s*/).find((part) => part.startsWith(session + '='));
      const [expires, signature] = cookie?.slice(session.length + 1).split('.') ?? [];
      if (!/^\d{13}$/.test(expires) || Number(expires) <= Date.now() ||
          !/^[a-f0-9]{64}$/.test(signature) ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(expires, password)))) {
        return error('관리자 비밀번호를 다시 입력해 주세요.', 401);
      }
      if (body?.action !== 'add') return error('지원하지 않는 요청입니다.', 400);

      const { day, url: website, description } = body;
      if (!Number.isInteger(day) || day < 1 || day > 999999 ||
          typeof description !== 'string' || !description.trim() || description.trim().length > 160 ||
          typeof website !== 'string' || website.length > 2048) {
        return error('DAY 번호, 주소, 설명을 확인해 주세요.', 400);
      }
      let parsed;
      try { parsed = new URL(website); } catch { return error('웹사이트 주소를 확인해 주세요.', 400); }
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        return error('http:// 또는 https:// 웹사이트 주소를 입력해 주세요.', 400);
      }

      const row = { day, url: parsed.href, description: description.trim() };
      const added = await redis('HSETNX', collection, String(day), JSON.stringify(row));
      return added ? json(row, 201) : error('이미 등록된 DAY 번호예요.', 409);
    } catch {
      return error('잠시 후 다시 시도해 주세요.', 503);
    }
  }
};
