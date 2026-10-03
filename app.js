import { h, render } from 'https://esm.sh/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { App } from './components/App.js';

const stats = window.INITIAL_STATS;
const generatedAt = window.GENERATED_AT;

render(h(App, { stats, generatedAt }), document.getElementById('app')); 