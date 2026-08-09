import { render } from '@builder.io/qwik';
import { App } from './App';

// Qwik 客户端挂载 (非 SSR 的简单示例)
render(document.getElementById('app')!, <App />);
