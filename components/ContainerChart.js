import { h } from 'https://esm.sh/preact';

const BAR_COLOR = '#6f42c1';

const archColors = {
    'amd64': '#00A4EF',
    'arm64': '#28a745',
};
const getArchColor = (arch) => archColors[arch] || '#999999';

function niceCeil(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
}

function median(values) {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A day counts as an outlier when it is far above the typical day. Such bars
// are clipped so that one spike does not flatten the rest of the series.
const OUTLIER_FACTOR = 4;

function renderDailyChart(daily, partialDate) {
    const entries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) return null;

    const width = 720;
    const height = 240;
    const padLeft = 50;
    const padRight = 16;
    const padTop = 40;
    const padBottom = 36;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const values = entries.map(([, v]) => v);
    const typical = median(values.filter(v => v > 0));
    const cap = typical > 0 ? typical * OUTLIER_FACTOR : Infinity;
    const regular = values.filter(v => v <= cap);
    const yMax = niceCeil(Math.max(1, ...(regular.length ? regular : values)));
    const clipped = entries.filter(([, v]) => v > yMax);

    const barGap = 2;
    const barW = Math.max(2, (plotW - barGap * (entries.length - 1)) / entries.length);

    const xFor = (i) => padLeft + i * (barW + barGap);
    const yFor = (v) => padTop + plotH - (Math.min(v, yMax) / yMax) * plotH;

    const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);

    const xLabels = entries
        .map(([d], i) => ({ i, d }))
        .filter(({ i, d }) => i === 0 || i === entries.length - 1 || d.endsWith('-01') || d.endsWith('-15'));

    return h('div', { style: 'margin-top: 2rem;' }, [
        h('h3', null, 'Daily pulls'),
        h('p', { style: 'color: #586069; font-size: 0.9rem; margin: 0 0 0.5rem;' }, [
            'Pulls per day as reported by GHCR for the whole package (all tags and versions).',
            clipped.length > 0
                ? ` Bars above ${yMax.toLocaleString()} are clipped and labelled with their actual value.`
                : '',
            partialDate ? ' The hatched bar is the current day and is still incomplete.' : '',
        ]),
        h('svg', {
            width, height,
            viewBox: `0 0 ${width} ${height}`,
            style: 'background: #fafbfc; border: 1px solid #e1e4e8; border-radius: 8px;',
        }, [
            h('defs', null, [
                h('pattern', {
                    id: 'partial-day', width: 6, height: 6,
                    patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)',
                }, [
                    h('rect', { width: 6, height: 6, fill: '#ffffff' }),
                    h('rect', { width: 3, height: 6, fill: BAR_COLOR, opacity: 0.6 }),
                ]),
            ]),
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
                const isPartial = date === partialDate;
                const isClipped = v > yMax;
                // Stagger labels of neighbouring clipped bars so they don't overlap.
                const clipRank = clipped.findIndex(([d]) => d === date);
                const labelY = padTop - 8 - (clipRank % 2) * 13;
                const y = yFor(v);
                const barH = padTop + plotH - y;
                const label = `${date}: ${v.toLocaleString()} pulls${isPartial ? ' (so far today)' : ''}`;
                return h('g', null, [
                    h('rect', {
                        x: xFor(i),
                        y,
                        width: barW,
                        height: barH,
                        fill: isPartial ? 'url(#partial-day)' : BAR_COLOR,
                        stroke: isPartial ? BAR_COLOR : 'none',
                        'stroke-width': isPartial ? 1 : 0,
                    }, [h('title', null, label)]),
                    // Clipped bars get a break mark at the top and their real value.
                    isClipped ? h('line', {
                        x1: xFor(i) - 2, x2: xFor(i) + barW + 2,
                        y1: padTop + 6, y2: padTop + 2,
                        stroke: '#fafbfc', 'stroke-width': 3,
                    }) : null,
                    isClipped ? h('text', {
                        x: xFor(i) + barW / 2, y: labelY,
                        'text-anchor': 'middle',
                        style: `font-size: 11px; font-weight: 600; fill: ${BAR_COLOR}; font-family: sans-serif;`,
                    }, v.toLocaleString()) : null,
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

const isKnownArch = (img) => img.arch === 'amd64' || img.arch === 'arm64';

function formatPulls(n) {
    return n == null ? '—' : n.toLocaleString();
}

function renderImageChip(img) {
    const short = img.digest.slice(0, 12);
    const href = img.url || img.signature_url;
    const titleLines = [
        `linux/${img.arch}`,
        `ghcr.io/freedomofpress/dangerzone/v1@sha256:${img.digest}`,
        img.downloads != null ? `${img.downloads.toLocaleString()} pulls` : 'pull count unavailable',
        img.url ? 'Open on GitHub Packages' : 'Open signature in ghcr-signer',
    ];
    return h('a', {
        href,
        target: '_blank',
        rel: 'noopener',
        title: titleLines.join('\n'),
        style: 'display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.5rem; background: #ffffff; border: 1px solid #d0d7de; border-radius: 6px; color: #24292e; text-decoration: none;',
    }, [
        h('span', { style: `width: 10px; height: 10px; border-radius: 2px; background: ${getArchColor(img.arch)};` }),
        h('span', { style: 'font-family: monospace;' }, `linux/${img.arch}`),
        h('code', { style: 'font-size: 0.78rem; color: #586069;' }, short),
        img.downloads != null
            ? h('span', { style: 'font-size: 0.78rem; color: #586069; border-left: 1px solid #d0d7de; padding-left: 0.4rem;' },
                `${img.downloads.toLocaleString()} pulls`)
            : null,
    ]);
}

function renderSignedReleases(batches) {
    const rows = batches
        .filter(batch => batch.images.some(isKnownArch))
        .slice().reverse();
    if (rows.length === 0) return null;

    const hasPullCounts = rows.some(b => b.images.some(img => img.downloads != null));
    const columns = '120px 1fr 110px';

    return h('div', { style: 'margin-top: 2rem;' }, [
        h('h3', null, 'Signed releases'),
        h('p', { style: 'color: #586069; font-size: 0.9rem; margin-top: 0; margin-bottom: 1rem;' },
            hasPullCounts
                ? 'Pulls of the multi-arch index (what users pull), with per-architecture image pulls on each chip, as reported on the GHCR package versions page. Links open the version on GitHub Packages.'
                : 'Per-version pull counts could not be fetched. Each image links to its signature in ghcr-signer.'
        ),
        h('div', {
            style: `display: grid; grid-template-columns: ${columns}; gap: 0.75rem; padding: 0.75rem 1rem; background: #24292e; color: white; border-radius: 8px 8px 0 0; font-size: 0.85rem; font-weight: 600;`,
        }, [
            h('div', null, 'Signed on'),
            h('div', null, 'Images'),
            h('div', { style: 'text-align: right;' }, 'Pulls'),
        ]),
        ...rows.map((batch, i) => {
            const date = batch.timestamp.split('T')[0];
            const bg = i % 2 === 0 ? '#f6f8fa' : '#ffffff';
            const images = batch.images.filter(isKnownArch).sort((a, b) => a.arch.localeCompare(b.arch));
            const counted = images.filter(img => img.downloads != null);
            const archTotal = counted.length > 0
                ? counted.reduce((sum, img) => sum + img.downloads, 0)
                : null;
            const index = batch.index;
            // Users pull the multi-arch index, so its count is the headline
            // figure; per-architecture counts are shown on each image chip.
            const indexPulls = index && index.downloads != null ? index.downloads : null;
            const totalTitle = [
                indexPulls != null ? `multi-arch index: ${indexPulls.toLocaleString()}` : null,
                ...counted.map(img => `linux/${img.arch}: ${img.downloads.toLocaleString()}`),
            ].filter(Boolean).join('\n');
            return h('div', {
                style: `display: grid; grid-template-columns: ${columns}; gap: 0.75rem; padding: 0.6rem 1rem; background: ${bg}; border-bottom: 1px solid #e1e4e8; align-items: center; font-size: 0.85rem;`,
            }, [
                h('a', {
                    href: batch.signature_url,
                    target: '_blank',
                    rel: 'noopener',
                    title: 'Open signatures in ghcr-signer',
                    style: 'font-weight: 500; color: #24292e; text-decoration: none;',
                }, date),
                h('div', { style: 'display: flex; gap: 0.75rem; flex-wrap: wrap;' }, images.map(renderImageChip)),
                h('div', { style: 'text-align: right; font-variant-numeric: tabular-nums;', title: totalTitle }, [
                    indexPulls != null && index.url
                        ? h('a', {
                            href: index.url,
                            target: '_blank',
                            rel: 'noopener',
                            style: 'font-weight: 600; color: #24292e; text-decoration: none;',
                            title: `multi-arch index sha256:${batch.index_digest}`,
                        }, formatPulls(indexPulls))
                        : h('div', { style: 'font-weight: 600;' }, formatPulls(indexPulls != null ? indexPulls : archTotal)),
                    indexPulls != null && archTotal != null
                        ? h('div', { style: 'font-size: 0.75rem; color: #586069;' }, `${archTotal.toLocaleString()} by arch`)
                        : null,
                ]),
            ]);
        }),
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
    // The last bucket of GHCR's series is the current UTC day, still being counted.
    const partialDate = data.daily_downloads_fetched_at
        ? data.daily_downloads_fetched_at.slice(0, 10)
        : null;

    const ghcrImage = 'ghcr.io/freedomofpress/dangerzone/v1';

    const dailyEntries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
    const completeEntries = dailyEntries.filter(([d]) => d !== partialDate);
    const dailySum = completeEntries.reduce((s, [, v]) => s + v, 0);
    const dailyAvg = completeEntries.length > 0
        ? Math.round(dailySum / completeEntries.length)
        : 0;
    const dailyMedian = Math.round(median(completeEntries.map(([, v]) => v)));

    return h('div', { class: 'charts' }, [
        h('div', { style: 'margin-bottom: 2rem;' }, [
            h('h2', null, 'Container Images'),
            h('p', { style: 'color: #586069; margin-bottom: 1rem;' }, [
                'Dangerzone container images are published to ',
                h('a', {
                    href: 'https://github.com/freedomofpress/dangerzone/pkgs/container/dangerzone%2Fv1',
                    target: '_blank',
                    rel: 'noopener',
                    style: 'color: #0366d6;',
                }, h('code', null, ghcrImage)),
                ' and signed via ',
                h('a', {
                    href: 'https://github.com/freedomofpress/ghcr-signer',
                    target: '_blank',
                    rel: 'noopener',
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
                    h('div', { class: 'summary-label' }, 'Pulls per day'),
                    h('div', { class: 'summary-value' }, dailyMedian.toLocaleString()),
                    h('div', { style: 'font-size: 0.85rem; color: #586069; margin-top: 0.25rem;' },
                        completeEntries.length > 0
                            ? `median over ${completeEntries.length} complete day${completeEntries.length === 1 ? '' : 's'} (average ${dailyAvg.toLocaleString()})`
                            : ''),
                ]),
            ]),
        ]),

        renderDailyChart(daily, partialDate),
        renderSignedReleases(batches),
        renderSizeChart(batches),
    ]);
}
