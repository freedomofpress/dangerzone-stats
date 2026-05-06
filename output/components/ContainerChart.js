import { h } from 'https://esm.sh/preact';

export function ContainerChart({ stats }) {
    if (!stats || !stats.container_images) {
        return h('div', { class: 'charts' }, 'No container image data available.');
    }

    const data = stats.container_images;
    const batches = data.batches || [];

    if (batches.length === 0) {
        return h('div', { class: 'charts' }, 'No signed container image batches found.');
    }

    const ghcrImage = 'ghcr.io/freedomofpress/dangerzone/v1';

    // Aggregate per-arch stats
    const archStats = {};  // arch -> { total: N, firstDate: str, lastDate: str }
    batches.forEach(batch => {
        const date = batch.timestamp.split('T')[0];
        batch.images.forEach(img => {
            const arch = img.arch || 'unknown';
            if (!archStats[arch]) {
                archStats[arch] = { total: 0, firstDate: date, lastDate: date };
            }
            archStats[arch].total += img.downloads || 0;
            if (date < archStats[arch].firstDate) archStats[arch].firstDate = date;
            if (date > archStats[arch].lastDate) archStats[arch].lastDate = date;
        });
    });

    // Compute downloads/week for each arch
    const archEntries = Object.entries(archStats).map(([arch, s]) => {
        const first = new Date(s.firstDate);
        const last = new Date(s.lastDate);
        const weeks = Math.max(1, (last - first) / (7 * 24 * 60 * 60 * 1000));
        const perWeek = s.total / weeks;
        return { arch, total: s.total, perWeek };
    });

    const totalDownloads = archEntries.reduce((sum, e) => sum + e.total, 0);

    const archColors = {
        'amd64': '#00A4EF',
        'arm64': '#28a745',
        'unknown': '#999999',
    };

    const getArchColor = (arch) => archColors[arch] || '#ff69b4';

    // Collect all unique architectures in consistent order
    const archOrder = [];
    batches.forEach(batch => {
        batch.images.forEach(img => {
            const arch = img.arch || 'unknown';
            if (!archOrder.includes(arch)) archOrder.push(arch);
        });
    });
    archOrder.sort(); // amd64, arm64, ...

    // Max total downloads per batch for bar scaling
    const maxBatchTotal = Math.max(1, ...batches.map(b =>
        b.images.reduce((sum, img) => sum + (img.downloads || 0), 0)
    ));
    const barMaxWidth = 400; // pixels

    return h('div', { class: 'charts' }, [
        // Header
        h('div', { style: 'margin-bottom: 2rem;' }, [
            h('h2', null, 'Container Images'),
            h('p', { style: 'color: #586069; margin-bottom: 1rem;' }, [
                'Dangerzone container images are published to ',
                h('code', null, ghcrImage),
                ' and signed via ',
                h('a', {
                    href: 'https://github.com/freedomofpress/ghcr-signer',
                    target: '_blank',
                    style: 'color: #0366d6;'
                }, 'ghcr-signer'),
                '.',
            ]),

            // Summary cards: total + per-arch breakdown
            h('div', { class: 'summary-grid' }, [
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #6f42c1' }, [
                    h('div', { class: 'summary-label' }, 'Signed Batches'),
                    h('div', { class: 'summary-value' }, batches.length.toString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #24292e' }, [
                    h('div', { class: 'summary-label' }, 'Total Image Downloads'),
                    h('div', { class: 'summary-value' }, totalDownloads.toLocaleString())
                ]),
                ...archEntries.map(({ arch, total, perWeek }) =>
                    h('div', { class: 'summary-card', style: `border-left: 4px solid ${getArchColor(arch)}` }, [
                        h('div', { class: 'summary-label' }, `linux/${arch}`),
                        h('div', { class: 'summary-value' }, total.toLocaleString()),
                        h('div', { style: 'font-size: 0.85rem; color: #586069; margin-top: 0.25rem;' },
                            `~${Math.round(perWeek).toLocaleString()}/week`
                        ),
                    ])
                ),
            ]),
        ]),

        // Signed batches table with stacked horizontal bars
        h('div', { style: 'margin-top: 2rem;' }, [
            h('h3', null, 'Signed Image Batches'),

            // Legend
            h('div', { style: 'display: flex; gap: 1.5rem; margin-bottom: 1rem;' },
                archOrder.map(arch =>
                    h('div', { style: 'display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;' }, [
                        h('span', {
                            style: `width: 14px; height: 14px; border-radius: 3px; background: ${getArchColor(arch)};`
                        }),
                        h('span', { style: 'font-family: monospace;' }, `linux/${arch}`),
                    ])
                )
            ),

            // Table header
            h('div', {
                style: 'display: grid; grid-template-columns: 100px 1fr 70px; gap: 0.75rem; padding: 0.75rem 1rem; background: #24292e; color: white; border-radius: 8px 8px 0 0; font-size: 0.85rem; font-weight: 600;'
            }, [
                h('div', null, 'Date'),
                h('div', null, 'Downloads'),
                h('div', { style: 'text-align: right;' }, 'Total'),
            ]),

            // One row per batch with a stacked bar
            ...batches.slice().reverse().map((batch, batchIdx) => {
                const date = batch.timestamp.split('T')[0];
                const bgColor = batchIdx % 2 === 0 ? '#f6f8fa' : '#ffffff';

                // Build image map by arch for consistent ordering
                const imageByArch = {};
                batch.images.forEach(img => {
                    imageByArch[img.arch || 'unknown'] = img;
                });

                const batchTotal = batch.images.reduce((sum, img) => sum + (img.downloads || 0), 0);
                const totalBarWidth = (batchTotal / maxBatchTotal) * barMaxWidth;

                return h('div', {
                    style: `display: grid; grid-template-columns: 100px 1fr 70px; gap: 0.75rem; padding: 0.6rem 1rem; background: ${bgColor}; border-bottom: 1px solid #e1e4e8; align-items: center;`
                }, [
                    // Date
                    h('div', {
                        style: 'font-weight: 500; color: #24292e; font-size: 0.85rem;'
                    }, date),
                    // Stacked bar
                    h('div', { style: 'display: flex; flex-direction: row; height: 26px;' },
                        archOrder.map((arch, archIdx) => {
                            const img = imageByArch[arch];
                            if (!img) return null;
                            const downloads = img.downloads || 0;
                            const segmentWidth = batchTotal > 0
                                ? (downloads / batchTotal) * totalBarWidth
                                : 0;
                            const isFirst = archIdx === 0;
                            const isLast = archIdx === archOrder.length - 1;
                            const radius = archOrder.length === 1
                                ? '4px'
                                : isFirst
                                    ? '4px 0 0 4px'
                                    : isLast
                                        ? '0 4px 4px 0'
                                        : '0';
                            return h('a', {
                                href: img.url || '#',
                                target: '_blank',
                                title: `linux/${arch}: ${downloads.toLocaleString()} downloads\nsha256:${img.digest}`,
                                style: `display: block; width: ${segmentWidth}px; height: 100%; background: ${getArchColor(arch)}; border-radius: ${radius}; cursor: pointer; transition: opacity 0.15s; text-decoration: none;`,
                                onmouseenter: (e) => { e.currentTarget.style.opacity = '0.7'; },
                                onmouseleave: (e) => { e.currentTarget.style.opacity = '1'; },
                            });
                        })
                    ),
                    // Total
                    h('div', {
                        style: 'text-align: right; font-size: 0.85rem; font-weight: 600; color: #24292e;'
                    }, batchTotal.toLocaleString()),
                ]);
            }),
        ]),
    ]);
}
