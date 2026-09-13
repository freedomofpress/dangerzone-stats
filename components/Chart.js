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
        .filter(release => !/(RC\d*|rc\d*|release.candidate)/i.test(release.name || ''))
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

    // Calculate overall Windows vs macOS distribution
    const overallStats = downloadsByRelease.reduce((acc, release) => {
        acc.windows += release.platforms['Windows'] || 0;
        acc.macIntel += release.platforms['Mac Intel'] || 0;
        acc.macSilicon += release.platforms['Mac Silicon'] || 0;
        return acc;
    }, { windows: 0, macIntel: 0, macSilicon: 0 });

    const totalMac = overallStats.macIntel + overallStats.macSilicon;
    const totalMainPlatforms = overallStats.windows + totalMac;
    const windowsPercent = totalMainPlatforms > 0 ? (overallStats.windows / totalMainPlatforms * 100).toFixed(1) : 0;
    const macPercent = totalMainPlatforms > 0 ? (totalMac / totalMainPlatforms * 100).toFixed(1) : 0;

    return h('div', { class: 'charts' }, [
        h('div', { class: 'chart horizontal' }, [
            // Overall platform distribution donut chart
            h('div', { style: 'margin-bottom: 2rem;' }, [
                h('h3', { style: 'margin-bottom: 1rem; text-align: center;' }, 'Overall Platform Distribution'),
                h('div', { class: 'donut-chart-container' }, [
                    renderDonutChart({
                        total: totalMainPlatforms,
                        windows: overallStats.windows,
                        mac: totalMac
                    }),
                    h('div', { class: 'donut-legend' }, [
                        h('div', { class: 'legend-item' }, [
                            h('span', { class: 'legend-color', style: 'background-color: #00A4EF' }),
                            h('span', { class: 'legend-label' },
                                `Windows: ${overallStats.windows.toLocaleString()} (${windowsPercent}%)`
                            )
                        ]),
                        h('div', { class: 'legend-item' }, [
                            h('span', { class: 'legend-color', style: 'background-color: #999999' }),
                            h('span', { class: 'legend-label' },
                                `macOS: ${totalMac.toLocaleString()} (${macPercent}%)`
                            )
                        ]),
                        h('div', { class: 'legend-total' },
                            `Total: ${totalMainPlatforms.toLocaleString()} downloads`
                        )
                    ])
                ]),
                h('p', { style: 'color: #586069; font-size: 0.85rem; text-align: center; margin-top: 0.5rem; font-style: italic;' },
                    'Linux packages are distributed via APT/DNF repositories and are not counted here.'
                )
            ]),

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

                                // Calculate percentage for main platforms (excluding Container and Other)
                                const mainPlatforms = ['Windows', 'Mac Intel', 'Mac Silicon'];
                                const mainPlatformsTotal = mainPlatforms.reduce((sum, p) => sum + release.platforms[p], 0);
                                const percentage = mainPlatforms.includes(platform) && mainPlatformsTotal > 0
                                    ? ((release.platforms[platform] / mainPlatformsTotal) * 100).toFixed(1)
                                    : null;

                                const tooltipText = percentage
                                    ? `${platform}: ${release.platforms[platform].toLocaleString()} downloads (${percentage}%)`
                                    : `${platform}: ${release.platforms[platform].toLocaleString()} downloads`;

                                return h('div', {
                                    class: 'bar stacked-bar horizontal',
                                    style: `
                                        width: ${width}px;
                                        background-color: ${getColorForPlatform(platform)};
                                    `,
                                    title: tooltipText
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

function renderDonutChart({ total, windows, mac }) {
    if (total === 0) return null;

    const size = 300;
    const strokeWidth = 60;
    const radius = (size / 2) - (strokeWidth / 2);
    const circumference = 2 * Math.PI * radius;

    const windowsPercent = windows / total;
    const macPercent = mac / total;

    // Calculate stroke lengths
    const windowsLength = circumference * windowsPercent;
    const macLength = circumference * macPercent;

    // For proper alignment without gaps:
    // First segment starts at top, second starts where first ends
    const rotationOffset = -90; // Start at top

    return h('svg', {
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
        class: 'donut-chart'
    }, [
        // Windows segment (blue) - first layer
        h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: 'none',
            stroke: '#00A4EF',
            'stroke-width': strokeWidth,
            'stroke-dasharray': `${windowsLength} ${circumference}`,
            transform: `rotate(${rotationOffset} ${size / 2} ${size / 2})`
        }),

        // macOS segment (gray) - second layer
        h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: 'none',
            stroke: '#999999',
            'stroke-width': strokeWidth,
            'stroke-dasharray': `${macLength} ${circumference}`,
            'stroke-dashoffset': -windowsLength,
            transform: `rotate(${rotationOffset} ${size / 2} ${size / 2})`
        }),

        // Center text
        h('g', null, [
            h('text', {
                x: size / 2,
                y: size / 2 - 10,
                'text-anchor': 'middle',
                'font-size': '36',
                'font-weight': 'bold',
                fill: '#24292e'
            }, total.toLocaleString()),
            h('text', {
                x: size / 2,
                y: size / 2 + 20,
                'text-anchor': 'middle',
                'font-size': '14',
                fill: '#586069'
            }, 'Total Downloads')
        ])
    ]);
} 