import { h } from 'https://esm.sh/preact';

export function Stats({ stats }) {
    return h('div', { class: 'stats-grid' }, [
        ...stats.releases.map(release =>
            h('div', { class: 'stat-card' }, [
                h('h2', null, [
                    h('a', { href: release.html_url, target: '_blank' }, release.name)
                ]),
                h('p', { class: 'release-date' },
                    new Date(release.published_at).toLocaleDateString()
                ),
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
            ])
        )
    ]);
} 