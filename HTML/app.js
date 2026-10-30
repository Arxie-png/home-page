const defaultShortcuts = [
  { name: 'Google', url: 'https://google.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'YouTube', url: 'https://youtube.com' },
];

const state = {
  shortcuts: JSON.parse(localStorage.getItem('shortcuts') || 'null') || defaultShortcuts,
  accent: localStorage.getItem('accent') || '#b7ff5a',
  backgroundColor: localStorage.getItem('backgroundColor') || '#5a5a5a',
};

const $ = (selector) => document.querySelector(selector);

function getShortcutLogoSources(url) {
  try {
    const shortcutUrl = new URL(url);
    const hostname = shortcutUrl.hostname;
    return [
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(shortcutUrl.origin)}&sz=256`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`,
    ];
  } catch {
    return [];
  }
}

function createShortcutLogo(url, name) {
  const logo = document.createElement('img');
  const sources = getShortcutLogoSources(url);
  logo.alt = `${name} logo`;
  logo.width = 256;
  logo.height = 256;
  logo.loading = 'lazy';
  logo.decoding = 'async';

  const useNextSource = () => {
    const nextSource = sources.shift();
    if (nextSource) {
      logo.src = nextSource;
    } else {
      logo.hidden = true;
    }
  };

  logo.addEventListener('error', useNextSource);
  useNextSource();
  return logo;
}

function renderShortcuts() {
  const grid = $('#shortcut-grid');
  grid.replaceChildren();
  state.shortcuts.forEach(({ name, url }) => {
    const link = document.createElement('a');
    link.className = 'shortcut-tile';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const logoContainer = document.createElement('span');
    logoContainer.className = 'shortcut-logo';
    logoContainer.append(createShortcutLogo(url, name));
    const shortcutName = document.createElement('span');
    shortcutName.className = 'shortcut-name';
    shortcutName.textContent = name;
    link.append(logoContainer, shortcutName);
    grid.append(link);
  });
}

function renderShortcutFields() {
  const fields = $('#shortcut-fields');
  fields.replaceChildren();
  state.shortcuts.forEach((shortcut, index) => appendShortcutField(shortcut, index));
  $('#add-shortcut').disabled = fields.children.length >= 10;
}

function appendShortcutField(shortcut, index) {
  const fields = $('#shortcut-fields');
  const row = document.createElement('div');
  row.className = 'shortcut-field';
  row.innerHTML = `
    <input aria-label="Shortcut ${index + 1} name" value="${shortcut.name}" placeholder="Website name">
    <input aria-label="Shortcut ${index + 1} URL" value="${shortcut.url}" placeholder="https://example.com" type="url">
    <button type="button" aria-label="Remove shortcut">Remove</button>
  `;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    $('#add-shortcut').disabled = fields.children.length >= 10;
  });
  fields.append(row);
}

function readShortcutFields() {
  return [...$('#shortcut-fields').children].map((row) => {
    const [name, url] = row.querySelectorAll('input');
    return { name: name.value.trim(), url: url.value.trim() };
  }).filter((shortcut) => shortcut.name && shortcut.url);
}

function updateShortcutEditorLimit() {
  $('#add-shortcut').disabled = $('#shortcut-fields').children.length >= 10;
}

// Keep unsaved editor rows separate from saved shortcuts so adding a row does
// not restore a shortcut that was removed.
function addEmptyShortcutField() {
  const fields = $('#shortcut-fields');
  if (fields.children.length >= 10) return;
  appendShortcutField({ name: '', url: '' }, fields.children.length);
  updateShortcutEditorLimit();
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
    const response = await fetch('/api/health', {
      cache: 'no-store',
    });
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
  state.backgroundColor = $('#background-color').value;
  localStorage.setItem('accent', state.accent);
  localStorage.setItem('backgroundColor', state.backgroundColor);
  document.documentElement.style.setProperty('--accent', state.accent);
  document.body.style.backgroundColor = state.backgroundColor;
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
  addEmptyShortcutField();
});

$('#save-shortcuts').addEventListener('click', () => {
  state.shortcuts = readShortcutFields();
  localStorage.setItem('shortcuts', JSON.stringify(state.shortcuts));
  renderShortcuts();
});

document.documentElement.style.setProperty('--accent', state.accent);
document.body.style.backgroundColor = state.backgroundColor;
$('#accent-color').value = state.accent;
$('#background-color').value = state.backgroundColor;
const savedBackground = localStorage.getItem('backgroundImage');
if (savedBackground) document.body.style.backgroundImage = `url("${savedBackground}")`;
renderShortcuts();

setHealthData(null);
loadHealthData();
