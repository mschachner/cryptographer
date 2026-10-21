import './style.css';
import { installFontFaces } from './fonts';
import { puzzleStore } from './store/db';
import { PuzzleJSON } from './model/types';
import { parseRoute } from './ui/app';
import { libraryScreen } from './ui/library';
import { homeScreen } from './ui/home';
import { editorScreen } from './ui/editor';
import { bankScreen } from './ui/bank';
import { settingsScreen } from './ui/settings';
import { solveScreen } from './ui/solve';

installFontFaces();
const root = document.getElementById('app')!;

/** On first run, put the bundled sample puzzle in the library. */
async function seedSample() {
  const flag = 'cryptographer.seeded';
  if (localStorage.getItem(flag)) return;
  localStorage.setItem(flag, '1');
  if (puzzleStore.list().length) return;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}samples/sample.json`);
    if (r.ok) {
      const j = (await r.json()) as PuzzleJSON;
      j.created = j.modified = new Date().toISOString();
      puzzleStore.putJSON(j);
      render();
    }
  } catch {
    // no sample is fine
  }
}

function render() {
  const route = parseRoute(location.hash);
  // close any open dialogs on navigation
  document.querySelectorAll('dialog').forEach((d) => d.remove());
  switch (route.name) {
    case 'edit': {
      const p = route.id ? puzzleStore.get(route.id) : undefined;
      if (!p) return void (location.hash = '#/library');
      const tray = JSON.parse(sessionStorage.getItem('cryptographer.tray') ?? '[]') as string[];
      sessionStorage.removeItem('cryptographer.tray');
      editorScreen(root, p, tray);
      break;
    }
    case 'bank':
      bankScreen(root);
      break;
    case 'settings':
      settingsScreen(root);
      break;
    case 'solve':
      solveScreen(root, { payload: route.payload });
      break;
    case 'preview': {
      const p = route.id ? puzzleStore.get(route.id) : undefined;
      if (!p) return void (location.hash = '#/');
      solveScreen(root, { puzzle: p });
      break;
    }
    case 'library':
      libraryScreen(root);
      break;
    default:
      homeScreen(root);
  }
}

window.addEventListener('hashchange', render);
render();
seedSample();

