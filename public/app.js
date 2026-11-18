const element = (id) => document.getElementById(id);
const dialog = element('editor');
const login = element('login');
const add = element('add');
const feedback = element('feedback');

async function api(body) {
  const response = await fetch('/api/sites', body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  } : {});
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error);
    error.status = response.status;
    throw error;
  }
  return data;
}

function draw(rows) {
  const status = element('list-status');
  status.textContent = rows.length ? '' : '아직 등록된 웹사이트가 없어요.';
  status.hidden = Boolean(rows.length);
  element('sites').replaceChildren(...rows.map((row) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = row.url;
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
    return item;
  }));
}

let rows = [];
let listLoaded = false;
const load = api().then((result) => {
  rows = result;
  listLoaded = true;
  draw(rows);
}).catch(() => {
  element('list-status').textContent = '목록을 불러오지 못했어요. 새로고침해 주세요.';
});

element('open').onclick = () => {
  login.hidden = false;
  add.hidden = true;
  feedback.textContent = '';
  login.reset();
  dialog.showModal();
  element('password').focus();
};
element('close').onclick = () => dialog.close();

async function submit(form, action) {
  const button = form.querySelector('button');
  button.disabled = true;
  feedback.textContent = '';
  try {
    await action();
  } catch (error) {
    if (form === add && error.status === 401) {
      add.hidden = true;
      login.hidden = false;
      element('password').focus();
    }
    feedback.textContent = error.status ? error.message : '연결을 확인하고 다시 시도해 주세요.';
  } finally {
    button.disabled = false;
  }
}

login.onsubmit = (event) => {
  event.preventDefault();
  const password = element('password').value;
  login.reset();
  submit(login, async () => {
    await api({ action: 'login', password });
    login.hidden = true;
    add.hidden = false;
    element('day').focus();
  });
};

add.onsubmit = (event) => {
  event.preventDefault();
  submit(add, async () => {
    const row = await api({
      action: 'add',
      day: element('day').valueAsNumber,
      url: element('url').value,
      description: element('description').value
    });
    await load;
    if (!listLoaded) {
      window.location.reload();
      return;
    }
    rows = [...rows.filter((entry) => entry.day !== row.day), row].sort((a, b) => a.day - b.day);
    draw(rows);
    add.reset();
    dialog.close();
  });
};
