const defaultShortcuts = [
  { name: 'Google', url: 'https://google.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'YouTube', url: 'https://youtube.com' },
];

const state = {
  shortcuts: JSON.parse(localStorage.getItem('shortcuts') || 'null') || defaultShortcuts,
  accent: localStorage.getItem('accent') || '#b7ff5a',
};

const $ = (selector) => document.querySelector(selector);

function renderShortcuts() {
  const grid = $('#shortcut-grid');
  grid.replaceChildren();
  state.shortcuts.forEach(({ name, url }) => {
    const link = document.createElement('a');
    link.className = 'shortcut-tile';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64" alt=""><span>${name}</span>`;
    grid.append(link);
  });
}

function renderShortcutFields() {
  const fields = $('#shortcut-fields');
  fields.replaceChildren();
  state.shortcuts.forEach((shortcut, index) => {
    const row = document.createElement('div');
    row.className = 'shortcut-field';
    row.innerHTML = `
      <input aria-label="Shortcut ${index + 1} name" value="${shortcut.name}" placeholder="Website name">
      <input aria-label="Shortcut ${index + 1} URL" value="${shortcut.url}" placeholder="https://example.com" type="url">
      <button type="button" aria-label="Remove shortcut">Remove</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      row.remove();
    });
    fields.append(row);
  });
  $('#add-shortcut').disabled = fields.children.length >= 10;
}

function setHealthData(data) {
  const steps = Number.isFinite(Number(data?.dailySteps)) ? Number(data.dailySteps) : null;
  const goal = Number.isFinite(Number(data?.stepGoal)) ? Number(data.stepGoal) : null;
  const sleep = typeof data?.sleepHours === 'string' && data.sleepHours ? data.sleepHours : null;
  $('#steps-value').textContent = steps === null ? 'No data' : steps.toLocaleString();
  $('#steps-ring').style.setProperty('--progress', steps === null || goal === null ? '0%' : `${Math.min(steps / goal, 1) * 100}%`);
  $('#sleep-value').textContent = sleep || 'No data';
}

async function loadHealthData() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`Health API returned ${response.status}`);
    }
    setHealthData(await response.json());
  } catch (error) {
    console.error('Unable to load health data:', error);
    setHealthData(null);
  }
}

$('#settings-button').addEventListener('click', () => $('#settings-dialog').showModal());
$('#edit-shortcuts').addEventListener('click', () => {
  renderShortcutFields();
  $('#shortcuts-dialog').showModal();
});

$('#save-settings').addEventListener('click', () => {
  state.accent = $('#accent-color').value;
  localStorage.setItem('accent', state.accent);
  document.documentElement.style.setProperty('--accent', state.accent);
});

$('#background-image').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    document.body.style.backgroundImage = `url("${reader.result}")`;
    localStorage.setItem('backgroundImage', reader.result);
  });
  reader.readAsDataURL(file);
});

$('#remove-background').addEventListener('click', () => {
  document.body.style.backgroundImage = '';
  localStorage.removeItem('backgroundImage');
});

$('#add-shortcut').addEventListener('click', () => {
  const fields = $('#shortcut-fields');
  if (fields.children.length >= 10) return;
  state.shortcuts.push({ name: '', url: '' });
  renderShortcutFields();
});

$('#save-shortcuts').addEventListener('click', () => {
  state.shortcuts = [...$('#shortcut-fields').children].map((row) => {
    const [name, url] = row.querySelectorAll('input');
    return { name: name.value.trim(), url: url.value.trim() };
  }).filter((shortcut) => shortcut.name && shortcut.url);
  localStorage.setItem('shortcuts', JSON.stringify(state.shortcuts));
  renderShortcuts();
});

document.documentElement.style.setProperty('--accent', state.accent);
const savedBackground = localStorage.getItem('backgroundImage');
if (savedBackground) document.body.style.backgroundImage = `url("${savedBackground}")`;
renderShortcuts();

setHealthData(null);
loadHealthData();
