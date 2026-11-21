import { h } from 'https://esm.sh/preact';

const PLATFORMS = [
    { key: 'Windows', color: '#00A4EF' },
    { key: 'macOS (Apple Silicon)', color: '#28a745' },
    { key: 'macOS (Intel)', color: '#A2AAAD' },
];

function classifyAsset(name) {
    const n = name.toLowerCase();
    if (n.endsWith('.asc') || n.startsWith('checksums')) return null;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const formatDate = (d) => d.toISOString().split('T')[0];

function renderPie(perPlatform, total) {
    if (total <= 0) return null;
    const size = 64;
    const r = size / 2;
    const cx = r, cy = r;
    let angle = -Math.PI / 2;
    const slices = PLATFORMS.map(p => {
        const v = perPlatform[p.key];
        if (v <= 0) return null;
        const share = v / total;
        const start = angle;
        const end = angle + share * 2 * Math.PI;
        angle = end;
        const pct = `${(share * 100).toFixed(1)}%`;
        const title = h('title', null, `${p.key}: ${v.toLocaleString()} (${pct})`);
        if (share >= 0.9999) {
            return h('circle', { cx, cy, r, fill: p.color }, [title]);
        }
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        const large = share > 0.5 ? 1 : 0;
        return h('path', {
            d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
            fill: p.color,
        }, [title]);
    });
    return h('svg', {
        width: size, height: size, viewBox: `0 0 ${size} ${size}`,
        style: 'flex-shrink: 0;',
    }, slices);
}

export function Stats({ stats }) {
    if (!stats || !Array.isArray(stats.releases)) {
        return h('div', { class: 'charts' }, 'No release data available.');
    }

    const today = new Date();
    const releases = stats.releases
        .filter(r => r.published_at)
        .map(r => {
            const perPlatform = Object.fromEntries(PLATFORMS.map(p => [p.key, 0]));
            (r.assets || []).forEach(a => {
                const p = classifyAsset(a.name);
                if (p) perPlatform[p] += a.download_count || 0;
            });
            return {
                release: r,
                publishedAt: new Date(r.published_at),
                prerelease: isPrerelease(r),
                perPlatform,
                platformTotal: Object.values(perPlatform).reduce((s, v) => s + v, 0),
                total: (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0),
            };
        })
        .sort((a, b) => a.publishedAt - b.publishedAt);

    // A release is "active" until the next one is published: the next stable
    // release for stable releases, the next release of any kind for pre-releases.
    releases.forEach((r, i) => {
        const next = releases.slice(i + 1).find(n => r.prerelease || !n.prerelease);
        r.windowEnd = next ? next.publishedAt : today;
        r.current = !next;
        r.days = Math.max(1, (r.windowEnd - r.publishedAt) / DAY_MS);
        r.perDay = r.total / r.days;
    });

    releases.sort((a, b) => b.publishedAt - a.publishedAt);

    return h('div', { class: 'stats-grid' },
        releases.map(r => {
            const release = r.release;
            const assets = (release.assets || []).slice()
                .sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
            return h('div', { class: 'stat-card' }, [
                h('div', { style: 'display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;' }, [
                    h('div', { style: 'min-width: 0;' }, [
                        h('h2', { style: 'display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;' }, [
                            h('a', { href: release.html_url, target: '_blank' }, release.name),
                            r.prerelease
                                ? h('span', { style: 'font-size: 0.7rem; font-weight: 600; color: #735c0f; background: #fff5b1; padding: 2px 6px; border-radius: 10px;' }, 'pre-release')
                                : null,
                        ]),
                        h('div', { class: 'release-date', style: 'margin: 0.25rem 0;' },
                            `${formatDate(r.publishedAt)}, active for ${Math.round(r.days).toLocaleString()} days`),
                        h('div', { style: 'display: flex; align-items: baseline; gap: 1rem; margin: 0.5rem 0;' }, [
                            h('span', { style: 'font-weight: 600; color: #24292e; font-size: 1.1rem;' },
                                `${r.total.toLocaleString()} downloads`),
                            h('span', { style: 'color: #586069; font-size: 0.9rem;' },
                                `${r.perDay.toFixed(r.perDay < 10 ? 1 : 0)} / day`),
                        ]),
                    ]),
                    renderPie(r.perPlatform, r.platformTotal),
                ]),
                h('div', { class: 'assets-list' },
                    assets.map(asset =>
                        h('div', { class: 'asset-item' }, [
                            h('a', {
                                href: asset.download_url,
                                class: 'asset-name',
                                target: '_blank'
                            }, asset.name),
                            h('span', { class: 'download-count' },
                                `${asset.download_count.toLocaleString()} downloads`
                            )
                        ])
                    )
                )
            ]);
        })
    );
}
