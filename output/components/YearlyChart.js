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

export function YearlyChart({ stats }) {
    if (!stats || !stats.releases || !Array.isArray(stats.releases)) {
        return h('div', { class: 'charts' }, 'No data available');
    }

    const platforms = ['Windows', 'Mac Intel', 'Mac Silicon', 'Container', 'Other'];

    // Group downloads by year
    const yearlyDownloads = stats.releases.reduce((acc, release) => {
        const year = new Date(release.published_at).getFullYear();

        if (!acc[year]) {
            acc[year] = platforms.reduce((platformAcc, platform) => {
                platformAcc[platform] = 0;
                return platformAcc;
            }, { total: 0 });
        }

        release.assets.forEach(asset => {
            const platform = getPlatform(asset.name);
            acc[year][platform] += asset.download_count || 0;
            acc[year].total += asset.download_count || 0;
        });

        return acc;
    }, {});

    // Convert to array and sort by year (descending)
    const yearlyStats = Object.entries(yearlyDownloads)
        .map(([year, stats]) => ({
            year: parseInt(year),
            platforms: stats,
            total: stats.total
        }))
        .sort((a, b) => b.year - a.year);

    const maxDownloads = Math.max(...yearlyStats.map(y => y.total));

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
                yearlyStats.map(yearStat =>
                    h('div', { class: 'bar-group horizontal' }, [
                        h('div', { class: 'bar-label horizontal' }, [
                            h('span', { class: 'version-label' }, yearStat.year)
                        ]),
                        h('div', { class: 'stacked-bars horizontal' },
                            platforms.map(platform => {
                                const width = (yearStat.platforms[platform] / maxDownloads) * 400;
                                return h('div', {
                                    class: 'bar stacked-bar horizontal',
                                    style: `
                                        width: ${width}px;
                                        background-color: ${getColorForPlatform(platform)};
                                    `,
                                    title: `${platform}: ${yearStat.platforms[platform].toLocaleString()} downloads`
                                });
                            })
                        ),
                        h('div', { class: 'total-downloads' },
                            `${yearStat.total.toLocaleString()} downloads`
                        )
                    ])
                )
            )
        ])
    ]);
} 