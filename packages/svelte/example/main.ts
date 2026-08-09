import { mount } from 'svelte';
import App from './App.svelte';

// Svelte 5 客户端挂载 API
const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
