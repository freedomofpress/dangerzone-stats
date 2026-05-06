import { h } from 'https://esm.sh/preact';

export function ContributionChart({ stats }) {
    if (!stats || !stats.contributions) {
        return h('div', { class: 'charts' }, 'No contribution data available');
    }

    const contributions = stats.contributions;
    const releases = stats.releases || [];
    const totals = contributions.totals || {};
    const timelines = contributions.contributor_timelines || {};
    const dataByPeriod = contributions.by_month;

    const newContributorsData = dataByPeriod.new_contributors || {};
    const activeContributorsData = dataByPeriod.active_contributors || {};

    // Convert to array and sort
    const allPeriods = new Set([
        ...Object.keys(newContributorsData),
        ...Object.keys(activeContributorsData)
    ]);

    const periodStats = Array.from(allPeriods)
        .map(period => ({
            period,
            newCount: newContributorsData[period] || 0,
            activeCount: activeContributorsData[period] || 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

    const maxCount = Math.max(
        ...periodStats.map(p => Math.max(p.newCount, p.activeCount)),
        1
    );

    // Calculate percentages for one-time vs repeat
    const totalContributors = totals.new_contributors || 0;
    const oneTimeCount = totals.one_time_contributors || 0;
    const repeatCount = totals.repeat_contributors || 0;
    const oneTimePercent = totalContributors > 0
        ? ((oneTimeCount / totalContributors) * 100).toFixed(1)
        : 0;
    const repeatPercent = totalContributors > 0
        ? ((repeatCount / totalContributors) * 100).toFixed(1)
        : 0;

    // Cohort retention data
    const cohorts = contributions.cohorts || {};
    const cohortYears = Object.keys(cohorts).sort();

    return h('div', { class: 'charts' }, [
        // Donut chart section - at the top
        h('div', { style: 'margin-bottom: 3rem;' }, [
            h('h2', null, 'Contributor Distribution'),
            h('div', { class: 'donut-chart-container' }, [
                renderDonutChart({
                    total: totalContributors,
                    oneTime: oneTimeCount,
                    repeat: repeatCount
                }),
                h('div', { class: 'donut-legend' }, [
                    h('div', { class: 'legend-item' }, [
                        h('span', { class: 'legend-color', style: 'background-color: #28a745' }),
                        h('span', { class: 'legend-label' },
                            `One-time Contributors: ${oneTimeCount} (${oneTimePercent}%)`
                        )
                    ]),
                    h('div', { class: 'legend-item' }, [
                        h('span', { class: 'legend-color', style: 'background-color: #007bff' }),
                        h('span', { class: 'legend-label' },
                            `Repeat Contributors: ${repeatCount} (${repeatPercent}%)`
                        )
                    ]),
                    h('div', { class: 'legend-total' },
                        `Total: ${totalContributors} contributors`
                    )
                ])
            ])
        ]),

        // Stacked area chart section
        Object.keys(timelines).length > 0 ? h('div', { style: 'margin-top: 3rem; margin-bottom: 3rem;' }, [
            h('h2', null, 'Contributor Activity Layers Over Time'),
            h('p', { style: 'color: #586069; margin-bottom: 1rem;' },
                'Each layer represents a contributor, showing when they were active and the volume of their contributions. You can see contributor transitions and who is "replacing" who over time.'
            ),
            renderStreamgraph(timelines,
                releases.filter(r => !/(RC\d*|rc\d*|release.candidate)/i.test(r.name || '')))
        ]) : h('div', { class: 'info-message' },
            'Contributor timeline data not available. Regenerate stats to see the activity layers visualization.'
        ),

        // Summary cards
        h('div', { class: 'contribution-summary' }, [
            // Active vs Inactive
            h('h3', null, 'Activity Status'),
            h('div', { class: 'summary-grid' }, [
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #20c997' }, [
                    h('div', { class: 'summary-label' }, 'Active (Last 3 Months)'),
                    h('div', { class: 'summary-value' }, (totals.active_3m || 0).toLocaleString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #17a2b8' }, [
                    h('div', { class: 'summary-label' }, 'Active (Last 6 Months)'),
                    h('div', { class: 'summary-value' }, (totals.active_6m || 0).toLocaleString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #ffc107' }, [
                    h('div', { class: 'summary-label' }, 'Active (Last 12 Months)'),
                    h('div', { class: 'summary-value' }, (totals.active_12m || 0).toLocaleString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #dc3545' }, [
                    h('div', { class: 'summary-label' }, 'Inactive (12+ Months)'),
                    h('div', { class: 'summary-value' }, (totals.inactive || 0).toLocaleString())
                ])
            ])
        ]),

        // Issue Tracking Charts
        contributions.burndown ? h('div', { style: 'margin-top: 3rem;' }, [
            h('h2', null, 'Issue Tracking'),
            h('div', { class: 'summary-grid', style: 'margin-bottom: 1rem;' }, [
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #dc3545' }, [
                    h('div', { class: 'summary-label' }, 'Open Bugs'),
                    h('div', { class: 'summary-value' }, (contributions.burndown.current?.open_bugs || 0).toLocaleString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #ff6b6b' }, [
                    h('div', { class: 'summary-label' }, 'Open Other Issues'),
                    h('div', { class: 'summary-value' }, (contributions.burndown.current?.open_other || 0).toLocaleString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #28a745' }, [
                    h('div', { class: 'summary-label' }, 'Total Open'),
                    h('div', { class: 'summary-value' }, (contributions.burndown.current?.open || 0).toLocaleString())
                ]),
                h('div', { class: 'summary-card', style: 'border-left: 4px solid #6f42c1' }, [
                    h('div', { class: 'summary-label' }, 'Closed Issues'),
                    h('div', { class: 'summary-value' }, (contributions.burndown.current?.closed || 0).toLocaleString())
                ])
            ]),

            // Issues Over Time - Stacked Area Chart
            h('div', { style: 'margin-top: 2rem;' }, [
                h('h3', null, 'Open Issues Over Time'),
                renderStackedIssuesChart(contributions.burndown,
                    releases.filter(r => !/(RC\d*|rc\d*|release.candidate)/i.test(r.name || '')))
            ])
        ]) : null
    ]);
}

// Stacked Area Chart
function renderStackedIssuesChart(burndown, releases) {
    if (!burndown || !burndown.by_month) return null;

    const byMonth = burndown.by_month;
    const cumulativeOpenBugs = byMonth.cumulative_bugs || {};
    const cumulativeOpenOther = byMonth.cumulative_other || {};
    const cumulativeOpen = byMonth.cumulative_open || {};

    const months = Object.keys(cumulativeOpen).sort();
    if (months.length === 0) return null;

    const data = months.map(month => {
        const openBugs = cumulativeOpenBugs[month] || 0;
        const openOther = cumulativeOpenOther[month] || 0;

        return {
            period: month,
            openBugs,
            openOther,
            total: openBugs + openOther
        };
    });

    return renderStackedAreaIssues(data, releases);
}

function renderMultiLineChart(title, data, lines, releases = []) {
    if (data.length === 0) return null;

    const width = 900;
    const height = 350;
    const padding = { top: 50, right: 60, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find max value across all lines for scaling
    const maxValue = Math.max(
        ...lines.flatMap(line => data.map(d => d[line.key] || 0)),
        1
    );

    // X-axis labels (show every nth label to avoid crowding)
    const labelInterval = Math.max(1, Math.floor(data.length / 10));
    const xLabels = data.filter((_, i) => i % labelInterval === 0 || i === data.length - 1);

    // Y-axis labels (5 ticks)
    const yTicks = Array.from({ length: 6 }, (_, i) => {
        const value = Math.round((maxValue / 5) * i);
        const y = padding.top + chartHeight - (i / 5) * chartHeight;
        return { value, y };
    });

    // Process releases - convert to month format and find positions
    const releaseMarkers = releases.map(release => {
        const date = new Date(release.published_at);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const index = data.findIndex(d => d.period === period);

        if (index === -1) return null;

        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        // Remove "Dangerzone" from the name to save space
        const cleanName = release.name.replace(/^Dangerzone\s+/i, '');
        return {
            x,
            name: cleanName,
            period
        };
    }).filter(Boolean);

    return h('div', { class: 'line-chart-container', style: 'margin-top: 2rem;' }, [
        h('h3', null, title),

        // Legend
        h('div', { class: 'chart-legend-inline' },
            lines.map(line =>
                h('div', { class: 'legend-item' }, [
                    h('span', {
                        class: 'legend-color',
                        style: `background-color: ${line.color}`
                    }),
                    h('span', { class: 'legend-label' }, line.label)
                ])
            )
        ),

        h('svg', {
            viewBox: `0 0 ${width} ${height}`,
            class: 'line-chart',
            style: 'width: 100%; height: auto;'
        }, [
            // Grid lines
            ...yTicks.map(tick =>
                h('line', {
                    x1: padding.left,
                    y1: tick.y,
                    x2: padding.left + chartWidth,
                    y2: tick.y,
                    stroke: '#e1e4e8',
                    'stroke-width': '1'
                })
            ),

            // Y-axis
            h('line', {
                x1: padding.left,
                y1: padding.top,
                x2: padding.left,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // X-axis
            h('line', {
                x1: padding.left,
                y1: padding.top + chartHeight,
                x2: padding.left + chartWidth,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // Release markers (vertical lines with labels)
            ...releaseMarkers.map((marker, idx) =>
                h('g', null, [
                    h('line', {
                        x1: marker.x,
                        y1: padding.top,
                        x2: marker.x,
                        y2: padding.top + chartHeight,
                        stroke: '#0366d6',
                        'stroke-width': '1',
                        'stroke-dasharray': '4,4',
                        opacity: '0.5'
                    }),
                    h('circle', {
                        cx: marker.x,
                        cy: padding.top - 5,
                        r: '3',
                        fill: '#0366d6'
                    }),
                    h('text', {
                        x: marker.x,
                        y: padding.top - 15,
                        'text-anchor': 'middle',
                        'font-size': '10',
                        fill: '#0366d6',
                        'font-weight': 'bold'
                    }, marker.name)
                ])
            ),

            // Y-axis labels
            ...yTicks.map(tick =>
                h('text', {
                    x: padding.left - 10,
                    y: tick.y + 4,
                    'text-anchor': 'end',
                    'font-size': '12',
                    fill: '#586069'
                }, tick.value.toString())
            ),

            // X-axis labels
            ...xLabels.map((d, idx) => {
                const pointIndex = data.findIndex(item => item.period === d.period);
                const x = padding.left + (pointIndex / (data.length - 1)) * chartWidth;
                return h('text', {
                    x: x,
                    y: padding.top + chartHeight + 20,
                    'text-anchor': 'middle',
                    'font-size': '11',
                    fill: '#586069',
                    transform: `rotate(-45 ${x} ${padding.top + chartHeight + 20})`
                }, d.period);
            }),

            // Render each line
            ...lines.flatMap(line => {
                // Calculate points for this line
                const points = data.map((d, i) => {
                    const x = padding.left + (i / (data.length - 1)) * chartWidth;
                    const y = padding.top + chartHeight - ((d[line.key] || 0) / maxValue) * chartHeight;
                    return { x, y, value: d[line.key] || 0, period: d.period };
                });

                // Create path data for the line
                const pathData = points.map((p, i) =>
                    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                ).join(' ');

                // Create area fill path
                const areaPath = points.length > 0 ?
                    pathData +
                    ` L ${points[points.length - 1].x} ${padding.top + chartHeight}` +
                    ` L ${points[0].x} ${padding.top + chartHeight} Z` : '';

                return [
                    // Area fill
                    h('path', {
                        d: areaPath,
                        fill: line.color,
                        opacity: '0.05'
                    }),

                    // Line
                    h('path', {
                        d: pathData,
                        stroke: line.color,
                        'stroke-width': '3',
                        fill: 'none',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round'
                    }),

                    // Data points
                    ...points.map(p =>
                        h('g', null, [
                            h('circle', {
                                cx: p.x,
                                cy: p.y,
                                r: '4',
                                fill: 'white',
                                stroke: line.color,
                                'stroke-width': '2'
                            }),
                            h('title', null, `${p.period}: ${p.value} ${line.label}`)
                        ])
                    )
                ];
            })
        ])
    ]);
}

function renderStackedBarChart(title, data, series, releases = []) {
    if (data.length === 0) return null;

    const width = 900;
    const height = 350;
    const padding = { top: 50, right: 60, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find max total value for scaling
    const maxValue = Math.max(...data.map(d => d.total), 1);

    // Calculate bar width based on number of data points (no spacing)
    const barSpacing = chartWidth / data.length;
    const barWidth = barSpacing;

    // Y-axis labels (5 ticks)
    const yTicks = Array.from({ length: 6 }, (_, i) => {
        const value = Math.round((maxValue / 5) * i);
        const y = padding.top + chartHeight - (i / 5) * chartHeight;
        return { value, y };
    });

    // X-axis labels (show every nth label to avoid crowding)
    const labelInterval = Math.max(1, Math.floor(data.length / 10));
    const xLabels = data.filter((_, i) => i % labelInterval === 0 || i === data.length - 1);

    // Process releases - convert to month format and find positions
    const releaseMarkers = releases.map(release => {
        const date = new Date(release.published_at);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const index = data.findIndex(d => d.period === period);

        if (index === -1) return null;

        const x = padding.left + (index + 0.5) * barSpacing;
        // Remove "Dangerzone" from the name to save space
        const cleanName = release.name.replace(/^Dangerzone\s+/i, '');
        return {
            x,
            name: cleanName,
            period
        };
    }).filter(Boolean);

    return h('div', { class: 'line-chart-container', style: 'margin-top: 2rem;' }, [
        h('h3', null, title),

        // Legend
        h('div', { class: 'chart-legend-inline' },
            series.map(s =>
                h('div', { class: 'legend-item' }, [
                    h('span', {
                        class: 'legend-color',
                        style: `background-color: ${s.color}`
                    }),
                    h('span', { class: 'legend-label' }, s.label)
                ])
            )
        ),

        h('svg', {
            viewBox: `0 0 ${width} ${height}`,
            class: 'line-chart',
            style: 'width: 100%; height: auto;'
        }, [
            // Grid lines
            ...yTicks.map(tick =>
                h('line', {
                    x1: padding.left,
                    y1: tick.y,
                    x2: padding.left + chartWidth,
                    y2: tick.y,
                    stroke: '#e1e4e8',
                    'stroke-width': '1'
                })
            ),

            // Y-axis
            h('line', {
                x1: padding.left,
                y1: padding.top,
                x2: padding.left,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // X-axis
            h('line', {
                x1: padding.left,
                y1: padding.top + chartHeight,
                x2: padding.left + chartWidth,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // Release markers (vertical lines with labels)
            ...releaseMarkers.map((marker, idx) =>
                h('g', null, [
                    h('line', {
                        x1: marker.x,
                        y1: padding.top,
                        x2: marker.x,
                        y2: padding.top + chartHeight,
                        stroke: '#0366d6',
                        'stroke-width': '1',
                        'stroke-dasharray': '4,4',
                        opacity: '0.5'
                    }),
                    h('circle', {
                        cx: marker.x,
                        cy: padding.top - 5,
                        r: '3',
                        fill: '#0366d6'
                    }),
                    h('text', {
                        x: marker.x,
                        y: padding.top - 15,
                        'text-anchor': 'middle',
                        'font-size': '10',
                        fill: '#0366d6',
                        'font-weight': 'bold'
                    }, marker.name)
                ])
            ),

            // Y-axis labels
            ...yTicks.map(tick =>
                h('text', {
                    x: padding.left - 10,
                    y: tick.y + 4,
                    'text-anchor': 'end',
                    'font-size': '12',
                    fill: '#586069'
                }, tick.value.toString())
            ),

            // X-axis labels
            ...xLabels.map((d, idx) => {
                const pointIndex = data.findIndex(item => item.period === d.period);
                const x = padding.left + (pointIndex + 0.5) * barSpacing;
                return h('text', {
                    x: x,
                    y: padding.top + chartHeight + 20,
                    'text-anchor': 'middle',
                    'font-size': '11',
                    fill: '#586069',
                    transform: `rotate(-45 ${x} ${padding.top + chartHeight + 20})`
                }, d.period);
            }),

            // Stacked bars
            ...data.flatMap((d, i) => {
                const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
                let cumulativeY = padding.top + chartHeight;

                // Render each segment of the stack from bottom to top
                return series.map(s => {
                    const value = d[s.key] || 0;
                    if (value === 0) return null;

                    const barHeight = (value / maxValue) * chartHeight;
                    const y = cumulativeY - barHeight;

                    const rect = h('g', null, [
                        h('rect', {
                            x: x,
                            y: y,
                            width: barWidth,
                            height: barHeight,
                            fill: s.color,
                            stroke: 'white',
                            'stroke-width': '1'
                        }),
                        h('title', null, `${d.period}\n${s.label}: ${value}\nTotal: ${d.total}`)
                    ]);

                    cumulativeY = y; // Update for next segment
                    return rect;
                }).filter(Boolean);
            })
        ])
    ]);
}

function renderDonutChart({ total, oneTime, repeat }) {
    if (total === 0) return null;

    const size = 300;
    const strokeWidth = 60;
    const radius = (size / 2) - (strokeWidth / 2);
    const circumference = 2 * Math.PI * radius;

    const oneTimePercent = oneTime / total;
    const repeatPercent = repeat / total;

    // Calculate stroke lengths
    const oneTimeLength = circumference * oneTimePercent;
    const repeatLength = circumference * repeatPercent;

    // For proper alignment without gaps:
    // First segment starts at top, second starts where first ends
    const rotationOffset = -90; // Start at top

    return h('svg', {
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
        class: 'donut-chart'
    }, [
        // One-time contributors segment (green) - first layer
        h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: 'none',
            stroke: '#28a745',
            'stroke-width': strokeWidth,
            'stroke-dasharray': `${oneTimeLength} ${circumference}`,
            transform: `rotate(${rotationOffset} ${size / 2} ${size / 2})`
        }),

        // Repeat contributors segment (blue) - second layer
        h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: 'none',
            stroke: '#007bff',
            'stroke-width': strokeWidth,
            'stroke-dasharray': `${repeatLength} ${circumference}`,
            'stroke-dashoffset': -oneTimeLength,
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
            }, 'Total Contributors')
        ])
    ]);
}

function renderStreamgraph(timelines, releases) {
    // Get all unique months from all contributors
    const allMonths = new Set();
    Object.values(timelines).forEach(timeline => {
        Object.keys(timeline.contributions_by_month).forEach(month => {
            allMonths.add(month);
        });
    });

    const months = Array.from(allMonths).sort();
    if (months.length === 0) return null;

    // Sort contributors by total contributions (descending)
    const sortedContributors = Object.entries(timelines)
        .sort((a, b) => b[1].total_contributions - a[1].total_contributions);

    // Build data structure for stacked area chart
    const data = months.map(month => {
        const point = { month };
        sortedContributors.forEach(([login, timeline]) => {
            point[login] = timeline.contributions_by_month[month] || 0;
        });
        return point;
    });

    const width = 900;
    const height = 500;
    const padding = { top: 50, right: 60, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find max stacked value for scaling
    const maxStackedValue = Math.max(
        ...data.map(d => {
            return sortedContributors.reduce((sum, [login]) => sum + (d[login] || 0), 0);
        }),
        1
    );

    // Calculate cap value - set to 50th percentile (median) of individual contributions
    // This prevents the biggest contributors from dominating the entire chart
    const allValues = [];
    data.forEach(d => {
        sortedContributors.forEach(([login]) => {
            const val = d[login] || 0;
            if (val > 0) allValues.push(val);
        });
    });
    allValues.sort((a, b) => a - b);
    const percentileIndex = Math.floor(allValues.length * 0.5);
    const capValue = allValues.length > 0 ? allValues[percentileIndex] : maxStackedValue;

    // Calculate max with capping applied
    const maxCappedValue = Math.max(
        ...data.map(d => {
            return sortedContributors.reduce((sum, [login]) => {
                return sum + Math.min(d[login] || 0, capValue);
            }, 0);
        }),
        1
    );

    // Generate colors for each contributor
    const colors = generateColors(sortedContributors.length);

    // Calculate stacked areas with capped values
    const areas = sortedContributors.map(([login, timeline], idx) => {
        let isCapped = false;

        const points = data.map((d, i) => {
            const x = padding.left + (i / (data.length - 1)) * chartWidth;

            // Calculate the baseline (sum of all previous layers, with capping)
            let baseline = 0;
            for (let j = 0; j < idx; j++) {
                const prevLogin = sortedContributors[j][0];
                const prevValue = d[prevLogin] || 0;
                baseline += Math.min(prevValue, capValue);
            }

            const value = d[login] || 0;
            const cappedValue = Math.min(value, capValue);

            // Track if this contributor ever exceeds the cap
            if (value > capValue) {
                isCapped = true;
            }

            const y0 = padding.top + chartHeight - ((baseline / maxCappedValue) * chartHeight);
            const y1 = padding.top + chartHeight - (((baseline + cappedValue) / maxCappedValue) * chartHeight);

            return { x, y0, y1, value: value, month: d.month }; // Keep original value for tooltip
        });

        return { login, timeline, points, color: colors[idx], isCapped };
    });

    // X-axis labels (show every nth label to avoid crowding)
    const labelInterval = Math.max(1, Math.floor(months.length / 15));
    const xLabels = months.filter((_, i) => i % labelInterval === 0 || i === months.length - 1);

    // Y-axis labels (5 ticks) - show capped scale
    const yTicks = Array.from({ length: 6 }, (_, i) => {
        const value = Math.round((maxCappedValue / 5) * i);
        const y = padding.top + chartHeight - (i / 5) * chartHeight;
        return { value, y };
    });

    // Process releases - convert to month format and find positions
    const releaseMarkers = releases.map(release => {
        const date = new Date(release.published_at);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const index = months.indexOf(period);

        if (index === -1) return null;

        const x = padding.left + (index / (months.length - 1)) * chartWidth;
        const cleanName = release.name.replace(/^Dangerzone\s+/i, '');
        return { x, name: cleanName, period };
    }).filter(Boolean);

    return h('div', { class: 'line-chart-container' }, [
        // Legend showing top contributors
        h('div', { class: 'streamgraph-legend' },
            sortedContributors.slice(0, 15).map(([login, timeline], idx) =>
                h('div', { class: 'legend-item-compact' }, [
                    h('span', {
                        class: 'legend-color-small',
                        style: `background-color: ${colors[idx]}`
                    }),
                    h('a', {
                        href: `https://github.com/${login}`,
                        target: '_blank',
                        class: 'legend-label-small'
                    }, `@${login}`)
                ])
            )
        ),

        h('svg', {
            viewBox: `0 0 ${width} ${height}`,
            class: 'streamgraph',
            style: 'width: 100%; height: auto;'
        }, [
            // Grid lines
            ...yTicks.map(tick =>
                h('line', {
                    x1: padding.left,
                    y1: tick.y,
                    x2: padding.left + chartWidth,
                    y2: tick.y,
                    stroke: '#e1e4e8',
                    'stroke-width': '1'
                })
            ),

            // Y-axis
            h('line', {
                x1: padding.left,
                y1: padding.top,
                x2: padding.left,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // X-axis
            h('line', {
                x1: padding.left,
                y1: padding.top + chartHeight,
                x2: padding.left + chartWidth,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // Release markers
            ...releaseMarkers.map(marker =>
                h('g', null, [
                    h('line', {
                        x1: marker.x,
                        y1: padding.top,
                        x2: marker.x,
                        y2: padding.top + chartHeight,
                        stroke: '#0366d6',
                        'stroke-width': '1',
                        'stroke-dasharray': '4,4',
                        opacity: '0.3'
                    }),
                    h('circle', {
                        cx: marker.x,
                        cy: padding.top - 5,
                        r: '3',
                        fill: '#0366d6'
                    }),
                    h('text', {
                        x: marker.x,
                        y: padding.top - 15,
                        'text-anchor': 'middle',
                        'font-size': '9',
                        fill: '#0366d6',
                        'font-weight': 'bold'
                    }, marker.name)
                ])
            ),

            // Y-axis labels
            ...yTicks.map(tick =>
                h('text', {
                    x: padding.left - 10,
                    y: tick.y + 4,
                    'text-anchor': 'end',
                    'font-size': '12',
                    fill: '#586069'
                }, tick.value.toString())
            ),

            // X-axis labels
            ...xLabels.map(month => {
                const index = months.indexOf(month);
                const x = padding.left + (index / (months.length - 1)) * chartWidth;
                return h('text', {
                    x: x,
                    y: padding.top + chartHeight + 20,
                    'text-anchor': 'end',
                    'font-size': '10',
                    fill: '#586069',
                    transform: `rotate(-45 ${x} ${padding.top + chartHeight + 20})`
                }, month);
            }),

            // Render stacked areas (from bottom to top)
            ...areas.map(area => {
                // Create smooth path for the area using monotone interpolation
                const topLine = smoothPath(area.points, 'x', 'y1');

                const reversedPoints = area.points.slice().reverse();
                const bottomLine = smoothPath(reversedPoints, 'x', 'y0');
                // Replace the leading 'M' in bottomLine with 'L' to connect
                const bottomLineContinued = 'L' + bottomLine.substring(1);

                const pathData = topLine + ' ' + bottomLineContinued + ' Z';

                return h('g', null, [
                    h('path', {
                        d: pathData,
                        fill: area.color,
                        stroke: 'white',
                        'stroke-width': '0.5',
                        opacity: '0.8'
                    }),
                    h('title', null,
                        `@${area.login} - ${area.timeline.total_contributions} contributions${area.isCapped ? ' (capped)' : ''}`
                    )
                ]);
            })
        ])
    ]);
}

// Attempt monotone cubic spline interpolation for smooth curves
function smoothPath(points, xKey, yKey) {
    if (points.length < 2) return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[xKey]} ${p[yKey]}`).join(' ');
    if (points.length === 2) return `M ${points[0][xKey]} ${points[0][yKey]} L ${points[1][xKey]} ${points[1][yKey]}`;

    // Monotone cubic hermite tangents (Fritsch-Carlson)
    const n = points.length;
    const xs = points.map(p => p[xKey]);
    const ys = points.map(p => p[yKey]);

    const ds = [];
    const ms = [];
    for (let i = 0; i < n - 1; i++) {
        const dx = xs[i + 1] - xs[i];
        ds.push(dx);
        ms.push((ys[i + 1] - ys[i]) / (dx || 1));
    }

    const tangents = new Array(n);
    tangents[0] = ms[0];
    tangents[n - 1] = ms[n - 2];
    for (let i = 1; i < n - 1; i++) {
        if (ms[i - 1] * ms[i] <= 0) {
            tangents[i] = 0;
        } else {
            tangents[i] = (ms[i - 1] + ms[i]) / 2;
        }
    }

    // Fritsch-Carlson monotonicity constraint
    for (let i = 0; i < n - 1; i++) {
        if (Math.abs(ms[i]) < 1e-10) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
        } else {
            const alpha = tangents[i] / ms[i];
            const beta = tangents[i + 1] / ms[i];
            const s = alpha * alpha + beta * beta;
            if (s > 9) {
                const t = 3 / Math.sqrt(s);
                tangents[i] = t * alpha * ms[i];
                tangents[i + 1] = t * beta * ms[i];
            }
        }
    }

    let path = `M ${xs[0]} ${ys[0]}`;
    for (let i = 0; i < n - 1; i++) {
        const dx = ds[i] / 3;
        const cx1 = xs[i] + dx;
        const cy1 = ys[i] + tangents[i] * dx;
        const cx2 = xs[i + 1] - dx;
        const cy2 = ys[i + 1] - tangents[i + 1] * dx;
        path += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${xs[i + 1]} ${ys[i + 1]}`;
    }
    return path;
}

function generateColors(count) {
    // Generate a harmonious color palette with better visual cohesion
    // Using softer, more muted tones that work well in layers
    const baseColors = [
        '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
        '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5ab1ef',
        '#ffb980', '#d87c7c', '#919e8b', '#d7ab82', '#6e7074',
        '#546570', '#c4ccd3', '#8dc1a9', '#759aa0', '#dd6b66',
        '#e69d87', '#8dc1a9', '#ea7e53', '#eedd78', '#73a373',
        '#73b9bc', '#7289ab', '#91ca8c', '#f49f42', '#ba74a3'
    ];

    // If we need more colors, generate them with consistent saturation/lightness
    const colors = [];
    for (let i = 0; i < count; i++) {
        if (i < baseColors.length) {
            colors.push(baseColors[i]);
        } else {
            // Generate additional colors using HSL with harmonious values
            const hue = (i * 137.508) % 360; // Golden angle for good distribution
            const saturation = 55 + (i % 2) * 10; // 55-65%
            const lightness = 60 + (i % 3) * 5; // 60-70%
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
    }
    return colors;
}

// Helper: Render stacked area chart for issues (Option 2)
function renderStackedAreaIssues(data, releases) {
    if (data.length === 0) return null;

    const width = 900;
    const height = 350;
    const padding = { top: 50, right: 60, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => d.total), 1);

    const yTicks = Array.from({ length: 6 }, (_, i) => {
        const value = Math.round((maxValue / 5) * i);
        const y = padding.top + chartHeight - (i / 5) * chartHeight;
        return { value, y };
    });

    // Show year labels on x-axis instead of every nth month
    const yearLabels = [];
    const seenYears = new Set();
    data.forEach((d, i) => {
        const year = d.period.split('-')[0];
        if (!seenYears.has(year)) {
            seenYears.add(year);
            yearLabels.push({ index: i, year });
        }
    });

    // Process releases
    const releaseMarkers = releases.map(release => {
        const date = new Date(release.published_at);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const index = data.findIndex(d => d.period === period);

        if (index === -1) return null;

        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        const cleanName = release.name.replace(/^Dangerzone\s+/i, '');
        return { x, name: cleanName, period };
    }).filter(Boolean);

    return h('div', { class: 'line-chart-container' }, [
        h('div', { class: 'chart-legend-inline' }, [
            h('div', { class: 'legend-item' }, [
                h('span', { class: 'legend-color', style: 'background-color: #ff9999' }),
                h('span', { class: 'legend-label' }, 'Open Other Issues')
            ]),
            h('div', { class: 'legend-item' }, [
                h('span', { class: 'legend-color', style: 'background-color: #dc3545' }),
                h('span', { class: 'legend-label' }, 'Open Bugs')
            ])
        ]),

        h('svg', {
            viewBox: `0 0 ${width} ${height}`,
            class: 'line-chart',
            style: 'width: 100%; height: auto;'
        }, [
            // Grid and axes
            ...yTicks.map(tick =>
                h('line', {
                    x1: padding.left,
                    y1: tick.y,
                    x2: padding.left + chartWidth,
                    y2: tick.y,
                    stroke: '#e1e4e8',
                    'stroke-width': '1'
                })
            ),
            h('line', {
                x1: padding.left,
                y1: padding.top,
                x2: padding.left,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),
            h('line', {
                x1: padding.left,
                y1: padding.top + chartHeight,
                x2: padding.left + chartWidth,
                y2: padding.top + chartHeight,
                stroke: '#24292e',
                'stroke-width': '2'
            }),

            // Release markers
            ...releaseMarkers.map(marker =>
                h('g', null, [
                    h('line', {
                        x1: marker.x,
                        y1: padding.top,
                        x2: marker.x,
                        y2: padding.top + chartHeight,
                        stroke: '#0366d6',
                        'stroke-width': '1',
                        'stroke-dasharray': '4,4',
                        opacity: '0.5'
                    }),
                    h('circle', {
                        cx: marker.x,
                        cy: padding.top - 5,
                        r: '3',
                        fill: '#0366d6'
                    }),
                    h('text', {
                        x: marker.x,
                        y: padding.top - 15,
                        'text-anchor': 'middle',
                        'font-size': '9',
                        fill: '#0366d6',
                        'font-weight': 'bold'
                    }, marker.name)
                ])
            ),

            // Y-axis labels
            ...yTicks.map(tick =>
                h('text', {
                    x: padding.left - 10,
                    y: tick.y + 4,
                    'text-anchor': 'end',
                    'font-size': '12',
                    fill: '#586069'
                }, tick.value.toString())
            ),

            // X-axis labels (years)
            ...yearLabels.map(({ index, year }) => {
                const x = padding.left + (index / (data.length - 1)) * chartWidth;
                return h('text', {
                    x: x,
                    y: padding.top + chartHeight + 20,
                    'text-anchor': 'middle',
                    'font-size': '12',
                    fill: '#586069'
                }, year);
            }),

            // Stacked areas (2 layers: open other on bottom, open bugs on top)
            (() => {
                // Layer 1: Open Other (bottom)
                const openOtherPoints = data.map((d, i) => ({
                    x: padding.left + (i / (data.length - 1)) * chartWidth,
                    y: padding.top + chartHeight - ((d.openOther / maxValue) * chartHeight)
                }));

                // Layer 2: Open Bugs (on top of open other)
                const openBugsPoints = data.map((d, i) => ({
                    x: padding.left + (i / (data.length - 1)) * chartWidth,
                    y: padding.top + chartHeight - ((d.total / maxValue) * chartHeight)
                }));

                const baseline = padding.top + chartHeight;

                // Open Other area: smooth top, straight baseline
                const otherTop = smoothPath(openOtherPoints, 'x', 'y');
                const openOtherPath = otherTop +
                    ` L ${openOtherPoints[openOtherPoints.length - 1].x} ${baseline}` +
                    ` L ${openOtherPoints[0].x} ${baseline} Z`;

                // Open Bugs area: smooth top, smooth bottom (= openOther reversed)
                const bugsTop = smoothPath(openBugsPoints, 'x', 'y');
                const otherReversed = smoothPath(openOtherPoints.slice().reverse(), 'x', 'y');
                const openBugsPath = bugsTop + ' L' + otherReversed.substring(1) + ' Z';

                return [
                    h('path', {
                        d: openOtherPath,
                        fill: '#ff9999',
                        opacity: '0.8'
                    }),
                    h('path', {
                        d: openBugsPath,
                        fill: '#dc3545',
                        opacity: '0.8'
                    })
                ];
            })()
        ])
    ]);
}
