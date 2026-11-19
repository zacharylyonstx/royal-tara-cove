import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cinzel/400.css';
import './ui/styles.css';
import { Game } from './core/Game.js';

const container = document.getElementById('game-container');
const ui = document.getElementById('ui');

// make sure the engraving typeface is ready before the first letter is drawn
const fonts = document.fonts
  ? Promise.all([document.fonts.load('italic 600 40px "Cormorant Garamond"'), document.fonts.load('400 20px "Cinzel"')]).catch(() => {})
  : Promise.resolve();

Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  window.game = new Game(container, ui);
});
