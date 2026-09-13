import { h } from 'https://esm.sh/preact';

export function Stats({ stats }) {
    return h('div', { class: 'stats-grid' }, [
        ...stats.releases.map(release => {
            const totalDownloads = release.assets.reduce((sum, a) => sum + (a.download_count || 0), 0);
            return h('div', { class: 'stat-card' }, [
                h('h2', null, [
                    h('a', { href: release.html_url, target: '_blank' }, release.name)
                ]),
                h('div', { style: 'display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0;' }, [
                    h('span', { class: 'release-date', style: 'margin: 0;' },
                        new Date(release.published_at).toLocaleDateString()
                    ),
                    h('span', {
                        style: 'font-weight: 600; color: #24292e; font-size: 0.95rem;'
                    }, `${totalDownloads.toLocaleString()} downloads`)
                ]),
                h('div', { class: 'assets-list' },
                    release.assets.map(asset =>
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
    ]);
} 