import { h } from 'https://esm.sh/preact';

const PLATFORM_COLORS = {
    'Windows': '#00A4EF',
    'macOS (Apple Silicon)': '#28a745',
    'macOS (Intel)': '#A2AAAD',
};

const PLATFORMS = ['Windows', 'macOS (Apple Silicon)', 'macOS (Intel)'];

function classifyAsset(name) {
    const n = name.toLowerCase();
    if (n.endsWith('.asc') || n.startsWith('checksums')) return null;
    if (n.startsWith('container') || n.startsWith('container-')) return null;
    if (n.endsWith('.msi')) return 'Windows';
    if (n.includes('arm64.dmg')) return 'macOS (Apple Silicon)';
    if (n.endsWith('.dmg')) return 'macOS (Intel)';
    return null;
}

function isPrerelease(release) {
    if (release.prerelease === true) return true;
    const name = (release.name || '').toLowerCase();
    return /\brc\d*\b/.test(name) || name.includes('pre-release') || name.includes('prerelease');
}

function monthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date, n) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

function daysBetween(a, b) {
    return Math.max(0, (b - a) / (24 * 60 * 60 * 1000));
}

function renderDonut(segments) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return null;
    const size = 240;
    const strokeWidth = 48;
    const radius = (size / 2) - (strokeWidth / 2);
    const circumference = 2 * Math.PI * radius;
    const rotation = -90;

    let offset = 0;
    const circles = segments.filter(s => s.value > 0).map(seg => {
        const len = circumference * (seg.value / total);
        const c = h('circle', {
            cx: size / 2, cy: size / 2, r: radius,
            fill: 'none',
            stroke: seg.color,
            'stroke-width': strokeWidth,
            'stroke-dasharray': `${len} ${circumference}`,
            'stroke-dashoffset': -offset,
            transform: `rotate(${rotation} ${size / 2} ${size / 2})`,
        });
        offset += len;
        return c;
    });

    return h('svg', {
        width: size, height: size,
        viewBox: `0 0 ${size} ${size}`,
    }, [
        ...circles,
        h('text', {
            x: size / 2, y: size / 2 - 8,
            'text-anchor': 'middle',
            style: 'font-size: 28px; font-weight: 700; fill: #24292e; font-family: sans-serif;',
        }, total.toLocaleString()),
        h('text', {
            x: size / 2, y: size / 2 + 16,
            'text-anchor': 'middle',
            style: 'font-size: 12px; fill: #586069; font-family: sans-serif;',
        }, 'Total downloads'),
    ]);
}

export function AssetDownloadsChart({ stats }) {
    if (!stats || !stats.releases || !Array.isArray(stats.releases)) {
        return h('div', { class: 'charts' }, 'No release data available.');
    }

    const releases = stats.releases
        .filter(r => !isPrerelease(r) && r.published_at)
        .map(r => {
            const perPlatform = Object.fromEntries(PLATFORMS.map(p => [p, 0]));
            (r.assets || []).forEach(a => {
                const p = classifyAsset(a.name);
                if (p) perPlatform[p] += a.download_count || 0;
            });
            return {
                name: (r.name || '').replace(/^Dangerzone\s+/i, ''),
                publishedAt: new Date(r.published_at),
                perPlatform,
                total: Object.values(perPlatform).reduce((s, v) => s + v, 0),
            };
        })
        .filter(r => r.total > 0)
        .sort((a, b) => a.publishedAt - b.publishedAt);

    if (releases.length === 0) {
        return h('div', { class: 'charts' }, 'No release assets with downloads found.');
    }

    const today = new Date();
    releases.forEach((r, i) => {
        r.windowStart = r.publishedAt;
        r.windowEnd = i + 1 < releases.length ? releases[i + 1].publishedAt : today;
    });

    const firstMonth = new Date(Date.UTC(releases[0].publishedAt.getUTCFullYear(), releases[0].publishedAt.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const months = [];
    for (let m = new Date(firstMonth); m <= lastMonth; m = addMonths(m, 1)) {
        months.push(new Date(m));
    }

    const monthData = months.map(m => {
        const monthStart = m;
        const monthEnd = addMonths(m, 1);
        const perPlatform = Object.fromEntries(PLATFORMS.map(p => [p, 0]));
        releases.forEach(r => {
            const overlapStart = r.windowStart > monthStart ? r.windowStart : monthStart;
            const overlapEnd = r.windowEnd < monthEnd ? r.windowEnd : monthEnd;
            if (overlapEnd <= overlapStart) return;
            const windowDays = daysBetween(r.windowStart, r.windowEnd);
            if (windowDays <= 0) return;
            const share = daysBetween(overlapStart, overlapEnd) / windowDays;
            PLATFORMS.forEach(p => {
                perPlatform[p] += r.perPlatform[p] * share;
            });
        });
        const total = Object.values(perPlatform).reduce((s, v) => s + v, 0);
        return { month: m, key: monthKey(m), perPlatform, total };
    });

    const maxMonthTotal = Math.max(1, ...monthData.map(d => d.total));

    const width = 960;
    const height = 360;
    const padLeft = 60;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 60;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const barGap = 2;
    const barWidth = Math.max(2, (plotW - barGap * (monthData.length - 1)) / monthData.length);

    const niceMax = Math.pow(10, Math.floor(Math.log10(maxMonthTotal)));
    const yMax = Math.ceil(maxMonthTotal / niceMax) * niceMax;
    const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);

    const xFor = i => padLeft + i * (barWidth + barGap);
    const yFor = v => padTop + plotH - (v / yMax) * plotH;

    const xLabels = monthData.map((d, i) => {
        if (d.month.getUTCMonth() === 0 || i === 0) {
            return { x: xFor(i) + barWidth / 2, text: String(d.month.getUTCFullYear()) };
        }
        return null;
    }).filter(Boolean);

    const grandTotalByPlatform = Object.fromEntries(PLATFORMS.map(p => [p, 0]));
    releases.forEach(r => {
        PLATFORMS.forEach(p => { grandTotalByPlatform[p] += r.perPlatform[p]; });
    });
    const grandTotal = Object.values(grandTotalByPlatform).reduce((s, v) => s + v, 0);

    const monthLabel = (d) =>
        d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', timeZone: 'UTC' });

    return h('div', { class: 'charts' }, [
        h('div', { style: 'margin-bottom: 1.5rem;' }, [
            h('h2', null, 'Downloads over time'),
            h('p', { style: 'color: #586069; font-size: 0.9rem; margin: 0.25rem 0 0;' },
                '(Linux app downloads not included — distributed via APT/DNF repositories.)'
            ),
        ]),

        h('div', {
            style: 'display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;'
        }, [
            renderDonut(PLATFORMS.map(p => ({
                label: p,
                value: grandTotalByPlatform[p],
                color: PLATFORM_COLORS[p],
            }))),
            h('div', { style: 'flex: 1; min-width: 320px;' }, [
                h('div', { class: 'summary-grid' },
                    PLATFORMS.map(p =>
                        h('div', { class: 'summary-card', style: `border-left: 4px solid ${PLATFORM_COLORS[p]}` }, [
                            h('div', { class: 'summary-label' }, p),
                            h('div', { class: 'summary-value' }, Math.round(grandTotalByPlatform[p]).toLocaleString()),
                            h('div', { style: 'font-size: 0.85rem; color: #586069; margin-top: 0.25rem;' },
                                grandTotal > 0
                                    ? `${((grandTotalByPlatform[p] / grandTotal) * 100).toFixed(1)}%`
                                    : '0%'
                            ),
                        ])
                    )
                ),
            ]),
        ]),

        h('div', { style: 'display: flex; gap: 1.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;' },
            PLATFORMS.map(p =>
                h('div', { style: 'display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;' }, [
                    h('span', { style: `width: 14px; height: 14px; border-radius: 3px; background: ${PLATFORM_COLORS[p]};` }),
                    h('span', null, p),
                ])
            )
        ),

        h('svg', {
            width, height,
            viewBox: `0 0 ${width} ${height}`,
            style: 'background: #fafbfc; border: 1px solid #e1e4e8; border-radius: 8px;'
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
                    style: 'font-size: 11px; fill: #586069; font-family: sans-serif;'
                }, v.toLocaleString()),
            ])),
            ...monthData.map((d, i) => {
                let yCursor = yFor(0);
                return h('g', null, PLATFORMS.map(p => {
                    const v = d.perPlatform[p];
                    if (v <= 0) return null;
                    const barH = yFor(0) - yFor(v);
                    yCursor -= barH;
                    return h('rect', {
                        x: xFor(i),
                        y: yCursor,
                        width: barWidth,
                        height: barH,
                        fill: PLATFORM_COLORS[p],
                    }, [
                        h('title', null,
                            `${monthLabel(d.month)}\n${p}: ${Math.round(v).toLocaleString()}\nMonth total: ${Math.round(d.total).toLocaleString()}`
                        ),
                    ]);
                }));
            }),
            ...xLabels.map(l => h('text', {
                x: l.x, y: height - padBottom + 20,
                'text-anchor': 'middle',
                style: 'font-size: 11px; fill: #586069; font-family: sans-serif;'
            }, l.text)),
            ...xLabels.map(l => h('line', {
                x1: l.x, x2: l.x,
                y1: height - padBottom, y2: height - padBottom + 5,
                stroke: '#586069', 'stroke-width': 1,
            })),
        ]),

        h('div', { style: 'margin-top: 1.5rem;' }, [
            h('h3', null, 'Releases included'),
            h('div', {
                style: 'display: grid; grid-template-columns: 140px 1fr 100px 110px; gap: 0.75rem; padding: 0.6rem 1rem; background: #24292e; color: white; border-radius: 8px 8px 0 0; font-size: 0.85rem; font-weight: 600;'
            }, [
                h('div', null, 'Published'),
                h('div', null, 'Release'),
                h('div', { style: 'text-align: right;' }, 'Active window'),
                h('div', { style: 'text-align: right;' }, 'Downloads'),
            ]),
            ...releases.slice().reverse().map((r, idx) =>
                h('div', {
                    style: `display: grid; grid-template-columns: 140px 1fr 100px 110px; gap: 0.75rem; padding: 0.5rem 1rem; background: ${idx % 2 === 0 ? '#f6f8fa' : '#ffffff'}; border-bottom: 1px solid #e1e4e8; font-size: 0.85rem; align-items: center;`
                }, [
                    h('div', null, r.publishedAt.toISOString().split('T')[0]),
                    h('div', { style: 'font-weight: 500;' }, r.name),
                    h('div', { style: 'text-align: right; color: #586069;' },
                        `${Math.round(daysBetween(r.windowStart, r.windowEnd))} days`
                    ),
                    h('div', { style: 'text-align: right; font-weight: 600;' }, r.total.toLocaleString()),
                ])
            ),
        ]),
    ]);
}
