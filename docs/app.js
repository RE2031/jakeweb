const status = document.getElementById('list-status');
const list = document.getElementById('sites');

try {
  const response = await fetch('./sites.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load the list');
  const rows = (await response.json()).sort((a, b) => a.day - b.day);
  for (const row of rows) {
    if (!Number.isSafeInteger(row.day) || row.day < 1 || typeof row.description !== 'string') continue;
    let url;
    try { url = new URL(row.url); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = url.href;
    for (const [className, value] of [
      ['day', 'DAY' + row.day], ['description', row.description], ['arrow', '↗']
    ]) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = value;
      if (className === 'arrow') span.setAttribute('aria-hidden', 'true');
      link.append(span);
    }
    item.append(link);
    list.append(item);
  }
  status.hidden = list.childElementCount > 0;
  status.textContent = '아직 등록된 웹사이트가 없어요.';
} catch {
  status.textContent = '목록을 불러오지 못했어요. 새로고침해 주세요.';
}
