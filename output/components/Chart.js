import { h } from 'https://esm.sh/preact';

function getPlatform(assetName) {
    assetName = assetName.toLowerCase();
    if (assetName.includes('msi')) return 'Windows';
    if (assetName.includes('arm64.dmg')) return 'Mac Silicon';
    if (assetName.includes('i686.dmg') || assetName.includes('.dmg')) return 'Mac Intel';
    if (assetName.includes('container')) return 'Container';
    return 'Other';
}

function getColorForPlatform(platform) {
    switch (platform) {
        case 'Windows': return '#00A4EF';
        case 'Mac Intel': return '#A2AAAD';
        case 'Mac Silicon': return '#C4C4C4';
        case 'Container': return '#FFD700';
        default: return '#FF69B4';
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short'
    });
}

export function Chart({ stats }) {
    console.log('Received stats:', stats);

    if (!stats || !stats.releases || !Array.isArray(stats.releases)) {
        return h('div', { class: 'charts' }, 'No data available');
    }

    const platforms = ['Windows', 'Mac Intel', 'Mac Silicon', 'Container', 'Other'];

    const downloadsByRelease = stats.releases
        .filter(release => release && release.name && release.published_at)
        .map(release => {
            console.log('Processing release:', release);
            return {
                name: (release.name || '').replace(/^Dangerzone /, ''),
                date: release.published_at,
                platforms: platforms.reduce((acc, platform) => {
                    acc[platform] = 0;
                    return acc;
                }, {}),
                total: 0,
                assets: release.assets || []
            };
        })
        .map(release => {
            release.assets.forEach(asset => {
                const platform = getPlatform(asset.name);
                release.platforms[platform] += asset.download_count || 0;
            });

            release.total = Object.values(release.platforms).reduce((a, b) => a + b, 0);
            return release;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('Processed releases:', downloadsByRelease);

    if (downloadsByRelease.length === 0) {
        return h('div', { class: 'charts' }, 'No release data available');
    }

    const maxDownloads = Math.max(...downloadsByRelease.map(r => r.total));

    return h('div', { class: 'charts' }, [
        h('div', { class: 'chart horizontal' }, [
            h('div', { class: 'chart-legend' },
                platforms.map(platform =>
                    h('div', { class: 'legend-item' }, [
                        h('span', {
                            class: 'legend-color',
                            style: `background-color: ${getColorForPlatform(platform)}`
                        }),
                        h('span', { class: 'legend-label' }, platform)
                    ])
                )
            ),
            h('div', { class: 'chart-container horizontal' },
                downloadsByRelease.map(release =>
                    h('div', { class: 'bar-group horizontal' }, [
                        h('div', { class: 'bar-label horizontal' }, [
                            h('span', { class: 'version-label' }, release.name),
                            h('span', { class: 'date-label' }, formatDate(release.date))
                        ]),
                        h('div', { class: 'stacked-bars horizontal' },
                            platforms.map(platform => {
                                const width = (release.platforms[platform] / maxDownloads) * 400;
                                return h('div', {
                                    class: 'bar stacked-bar horizontal',
                                    style: `
                                        width: ${width}px;
                                        background-color: ${getColorForPlatform(platform)};
                                    `,
                                    title: `${platform}: ${release.platforms[platform].toLocaleString()} downloads`
                                });
                            })
                        ),
                        h('div', { class: 'total-downloads' },
                            `${release.total.toLocaleString()} downloads`
                        )
                    ])
                )
            )
        ])
    ]);
} 