import './styles.css';
import { renderController } from './controller';
import { renderScreen } from './screen';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('No existe #app');

const path = window.location.pathname.replace(/\/+$/, '') || '/';
if (path === '/controller') renderController(app);
else renderScreen(app);
