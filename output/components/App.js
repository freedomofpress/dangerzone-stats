import { h } from 'https://esm.sh/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { Stats } from './Stats.js';
import { Chart } from './Chart.js';

export function App({ stats, generatedAt }) {
    const [activeTab, setActiveTab] = useState('charts');

    return h('div', { class: 'container' }, [
        h('header', { class: 'header' }, [
            h('h1', null, 'Dangerzone Release Stats'),
            h('p', null, `Generated at: ${new Date(generatedAt).toLocaleString()}`)
        ]),
        h('nav', { class: 'tabs' }, [
            h('button', {
                class: activeTab === 'charts' ? 'active' : '',
                onClick: () => setActiveTab('charts')
            }, 'Charts'),
            h('button', {
                class: activeTab === 'overview' ? 'active' : '',
                onClick: () => setActiveTab('overview')
            }, 'Overview')
        ]),
        activeTab === 'charts'
            ? h(Chart, { stats })
            : h(Stats, { stats })
    ]);
} 