import '../styles/app.css';
import { mount } from 'svelte';
import '../lib/i18n';
import App from './App.svelte';

mount(App, {
  target: document.getElementById('app')!,
});
