import { h } from 'https://esm.sh/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { Stats } from './Stats.js';
import { Chart } from './Chart.js';
import { YearlyChart } from './YearlyChart.js';

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
            }, 'By Release'),
            h('button', {
                class: activeTab === 'yearly' ? 'active' : '',
                onClick: () => setActiveTab('yearly')
            }, 'By Year'),
            h('button', {
                class: activeTab === 'overview' ? 'active' : '',
                onClick: () => setActiveTab('overview')
            }, 'Overview')
        ]),
        activeTab === 'charts' ? h(Chart, { stats }) :
            activeTab === 'yearly' ? h(YearlyChart, { stats }) :
                h(Stats, { stats })
    ]);
} 