import { h } from 'https://esm.sh/preact';

const BAR_COLOR = '#6f42c1';

const archColors = {
    'amd64': '#00A4EF',
    'arm64': '#28a745',
};
const getArchColor = (arch) => archColors[arch] || '#999999';

function renderDailyChart(daily) {
    const entries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) return null;

    const width = 720;
    const height = 220;
    const padLeft = 50;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 36;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxV = Math.max(1, ...entries.map(([, v]) => v));
    const niceMax = Math.pow(10, Math.floor(Math.log10(maxV)));
    const yMax = Math.ceil(maxV / niceMax) * niceMax;

    const barGap = 2;
    const barW = Math.max(2, (plotW - barGap * (entries.length - 1)) / entries.length);

    const xFor = (i) => padLeft + i * (barW + barGap);
    const yFor = (v) => padTop + plotH - (v / yMax) * plotH;

    const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);

    const xLabels = entries
        .map(([d], i) => ({ i, d }))
        .filter(({ i, d }) => i === 0 || i === entries.length - 1 || d.endsWith('-01') || d.endsWith('-15'));

    return h('div', { style: 'margin-top: 2rem;' }, [
        h('h3', null, 'Daily pulls'),
        h('svg', {
            width, height,
            viewBox: `0 0 ${width} ${height}`,
            style: 'background: #fafbfc; border: 1px solid #e1e4e8; border-radius: 8px;',
        }, [
            ...yTicks.map(v => h('g', null, [
                h('line', {
                    x1: padLeft, x2: width - padRight,
                    y1: yFor(v), y2: yFor(v),
                    stroke: '#e1e4e8', 'stroke-width': 1,
                }),
                h('text', {
                    x: padLeft - 8, y: yFor(v) + 4,
                    'text-anchor': 'end',
                    style: 'font-size: 11px; fill: #586069; font-family: sans-serif;',
                }, v.toLocaleString()),
            ])),
            ...entries.map(([date, v], i) => {
                const barH = (v / yMax) * plotH;
                return h('rect', {
                    x: xFor(i),
                    y: yFor(v),
                    width: barW,
                    height: barH,
                    fill: BAR_COLOR,
                }, [
                    h('title', null, `${date}: ${v.toLocaleString()} pulls`),
                ]);
            }),
            ...xLabels.map(({ i, d }) => h('text', {
                x: xFor(i) + barW / 2, y: height - padBottom + 18,
                'text-anchor': 'middle',
                style: 'font-size: 11px; fill: #586069; font-family: sans-serif;',
            }, d.slice(5))),
        ]),
    ]);
}

function renderSizeChart(batches) {
    const KNOWN = new Set(['amd64', 'arm64']);
    const archOrder = [];
    const sizeSeries = {};
    batches.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)).forEach(batch => {
        const date = new Date(batch.timestamp);
        batch.images.forEach(img => {
            if (!KNOWN.has(img.arch)) return;
            const size = img.size || 0;
            if (size <= 0) return;
            if (!archOrder.includes(img.arch)) archOrder.push(img.arch);
            if (!sizeSeries[img.arch]) sizeSeries[img.arch] = [];
            sizeSeries[img.arch].push({ date, sizeMB: size / (1024 * 1024) });
        });
    });
    archOrder.sort();
    const activeArchs = archOrder.filter(a => sizeSeries[a] && sizeSeries[a].length > 0);
    const allPts = activeArchs.flatMap(a => sizeSeries[a]);
    if (allPts.length === 0) return null;

    const width = 720;
    const height = 260;
    const padLeft = 60;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 40;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const sortedDates = [...new Set(allPts.map(p => p.date.getTime()))].sort((a, b) => a - b);
    const minDate = sortedDates[0];
    const maxDate = sortedDates[sortedDates.length - 1];
    const dateSpan = Math.max(1, maxDate - minDate);

    const sizes = allPts.map(p => p.sizeMB);
    const yLo = Math.max(0, Math.floor(Math.min(...sizes) * 0.95));
    const yHi = Math.ceil(Math.max(...sizes) * 1.05);
    const ySpan = Math.max(1, yHi - yLo);

    const xFor = t => padLeft + ((t - minDate) / dateSpan) * plotW;
    const yFor = mb => padTop + plotH - ((mb - yLo) / ySpan) * plotH;
    const yTicks = Array.from({ length: 5 }, (_, i) => yLo + (ySpan * i) / 4);
    const xTickCount = Math.min(6, sortedDates.length);
    const xTicks = Array.from({ length: xTickCount }, (_, i) =>
        sortedDates[Math.round((i * (sortedDates.length - 1)) / Math.max(1, xTickCount - 1))]
    );
    const formatDate = (t) =>
        new Date(t).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });

    return h('div', { style: 'margin-top: 2rem;' }, [
        h('h3', null, 'Image size evolution'),
        h('p', { style: 'color: #586069; font-size: 0.9rem; margin: 0 0 0.5rem;' },
            'Total compressed image size (config + layers) per signed batch, by architecture.'
        ),
        h('div', { style: 'display: flex; gap: 1.5rem; margin-bottom: 0.75rem;' },
            activeArchs.map(arch =>
                h('div', { style: 'display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;' }, [
                    h('span', { style: `width: 14px; height: 14px; border-radius: 3px; background: ${getArchColor(arch)};` }),
                    h('span', { style: 'font-family: monospace;' }, `linux/${arch}`),
                ])
            )
        ),
        h('svg', {
            width, height,
            viewBox: `0 0 ${width} ${height}`,
            style: 'background: #fafbfc; border: 1px solid #e1e4e8; border-radius: 8px;',
        }, [
            ...yTicks.map(v => h('g', null, [
                h('line', {
                    x1: padLeft, x2: width - padRight,
                    y1: yFor(v), y2: yFor(v),
                    stroke: '#e1e4e8', 'stroke-width': 1,
                }),
                h('text', {
                    x: padLeft - 8, y: yFor(v) + 4,
                    'text-anchor': 'end',
                    style: 'font-size: 11px; fill: #586069; font-family: sans-serif;',
                }, `${v.toFixed(0)} MB`),
            ])),
            ...xTicks.map(t => h('text', {
                x: xFor(t), y: height - padBottom + 16,
                'text-anchor': 'middle',
                style: 'font-size: 11px; fill: #586069; font-family: sans-serif;',
            }, formatDate(t))),
            ...activeArchs.map(arch => {
                const pts = sizeSeries[arch];
                const color = getArchColor(arch);
                const d = pts.map((p, i) =>
                    `${i === 0 ? 'M' : 'L'} ${xFor(p.date.getTime())} ${yFor(p.sizeMB)}`
                ).join(' ');
                return h('g', null, [
                    h('path', { d, fill: 'none', stroke: color, 'stroke-width': 2 }),
                    ...pts.map(p => h('circle', {
                        cx: xFor(p.date.getTime()),
                        cy: yFor(p.sizeMB),
                        r: 3.5,
                        fill: color,
                        stroke: '#fff',
                        'stroke-width': 1,
                    }, [
                        h('title', null,
                            `linux/${arch}\n${p.date.toISOString().split('T')[0]}\n${p.sizeMB.toFixed(1)} MB`
                        ),
                    ])),
                ]);
            }),
        ]),
    ]);
}

export function ContainerChart({ stats }) {
    if (!stats || !stats.container_images) {
        return h('div', { class: 'charts' }, 'No container image data available.');
    }

    const data = stats.container_images;
    const batches = data.batches || [];
    const totalDownloads = data.total_downloads;
    const daily = data.daily_downloads || {};

    const ghcrImage = 'ghcr.io/freedomofpress/dangerzone/v1';

    const dailyEntries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
    const dailySum = dailyEntries.reduce((s, [, v]) => s + v, 0);
    const dailyAvg = dailyEntries.length > 0
        ? Math.round(dailySum / dailyEntries.length)
        : 0;

    return h('div', { class: 'charts' }, [
        h('div', { style: 'margin-bottom: 2rem;' }, [
            h('h2', null, 'Container Images'),
            h('p', { style: 'color: #586069; margin-bottom: 1rem;' }, [
                'Dangerzone container images are published to ',
                h('code', null, ghcrImage),
                ' and signed via ',
                h('a', {
                    href: 'https://github.com/freedomofpress/ghcr-signer',
                    target: '_blank',
                    style: 'color: #0366d6;',
                }, 'ghcr-signer'),
                '.',
            ]),

            h('div', { class: 'summary-grid' }, [
                h('div', { class: 'summary-card', style: `border-left: 4px solid ${BAR_COLOR}` }, [
                    h('div', { class: 'summary-label' }, 'Total pulls'),
                    h('div', { class: 'summary-value' },
                        totalDownloads != null ? totalDownloads.toLocaleString() : '—'),
                ]),
                h('div', { class: 'summary-card', style: `border-left: 4px solid ${BAR_COLOR}` }, [
                    h('div', { class: 'summary-label' }, 'Pulls per day (avg)'),
                    h('div', { class: 'summary-value' }, dailyAvg.toLocaleString()),
                    h('div', { style: 'font-size: 0.85rem; color: #586069; margin-top: 0.25rem;' },
                        dailyEntries.length > 0
                            ? `over ${dailyEntries.length} day${dailyEntries.length === 1 ? '' : 's'}`
                            : ''),
                ]),
            ]),
        ]),

        renderDailyChart(daily),

        batches.length > 0 ? h('div', { style: 'margin-top: 2rem;' }, [
            h('h3', null, 'Signed releases'),
            h('p', { style: 'color: #586069; font-size: 0.9rem; margin-top: 0; margin-bottom: 1rem;' },
                'GHCR does not publish per-release pull counts for container packages. Only the aggregate total above is available.'
            ),
            h('div', {
                style: 'display: grid; grid-template-columns: 120px 1fr; gap: 0.75rem; padding: 0.75rem 1rem; background: #24292e; color: white; border-radius: 8px 8px 0 0; font-size: 0.85rem; font-weight: 600;',
            }, [
                h('div', null, 'Signed on'),
                h('div', null, 'Images'),
            ]),
            ...batches
                .filter(batch => batch.images.some(img => img.arch === 'amd64' || img.arch === 'arm64'))
                .slice().reverse().map((batch, i) => {
                const date = batch.timestamp.split('T')[0];
                const bg = i % 2 === 0 ? '#f6f8fa' : '#ffffff';
                return h('div', {
                    style: `display: grid; grid-template-columns: 120px 1fr; gap: 0.75rem; padding: 0.6rem 1rem; background: ${bg}; border-bottom: 1px solid #e1e4e8; align-items: center; font-size: 0.85rem;`,
                }, [
                    h('div', { style: 'font-weight: 500; color: #24292e;' }, date),
                    h('div', { style: 'display: flex; gap: 0.75rem; flex-wrap: wrap;' },
                        batch.images
                            .filter(img => img.arch === 'amd64' || img.arch === 'arm64')
                            .sort((a, b) => a.arch.localeCompare(b.arch))
                            .map(img => {
                                const short = img.digest.slice(0, 12);
                                const ghUrl = `https://github.com/freedomofpress/dangerzone/pkgs/container/dangerzone%2Fv1`;
                                return h('a', {
                                    href: ghUrl,
                                    target: '_blank',
                                    title: `linux/${img.arch}\nsha256:${img.digest}\nghcr.io/freedomofpress/dangerzone/v1@sha256:${img.digest}`,
                                    style: `display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.5rem; background: #ffffff; border: 1px solid #d0d7de; border-radius: 6px; color: #24292e; text-decoration: none;`,
                                }, [
                                    h('span', { style: `width: 10px; height: 10px; border-radius: 2px; background: ${getArchColor(img.arch)};` }),
                                    h('span', { style: 'font-family: monospace;' }, `linux/${img.arch}`),
                                    h('code', { style: 'font-size: 0.78rem; color: #586069;' }, short),
                                ]);
                            })
                    ),
                ]);
            }),
        ]) : null,

        renderSizeChart(batches),
    ]);
}
