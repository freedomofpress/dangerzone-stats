import { h } from 'https://esm.sh/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { Stats } from './Stats.js';
import { Chart } from './Chart.js';
import { YearlyChart } from './YearlyChart.js';
import { ContributionChart } from './ContributionChart.js';
import { ContainerChart } from './ContainerChart.js';

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
                class: activeTab === 'containers' ? 'active' : '',
                onClick: () => setActiveTab('containers')
            }, 'Container Images'),
            h('button', {
                class: activeTab === 'overview' ? 'active' : '',
                onClick: () => setActiveTab('overview')
            }, 'Overview'),
            h('button', {
                class: activeTab === 'contributions' ? 'active' : '',
                onClick: () => setActiveTab('contributions')
            }, 'Contribution Metrics')
        ]),
        activeTab === 'charts' ? h(Chart, { stats }) :
            activeTab === 'yearly' ? h(YearlyChart, { stats }) :
                activeTab === 'containers' ? h(ContainerChart, { stats }) :
                    activeTab === 'contributions' ? h(ContributionChart, { stats }) :
                        h(Stats, { stats })
    ]);
} 