#!/usr/bin/env node
import { program } from 'commander';
import googleTrends from 'google-trends-api';

program
    .name('search')
    .description('Google Trends CLI for topic research')
    .requiredOption('-k, --keyword <string>', 'Topic to search')
    .option('-p, --property <string>', 'youtube | web | images | news | froogle', 'youtube')
    .option('-t, --time <string>', 'Time range (now 7-d, now 1-m, today 3-m, today 12-m)', 'now 7-d')
    .option('-c, --category <number>', 'Category ID (5 = Tech)', '5')
    .option('-o, --output <string>', 'Output format: table | json | markdown', 'table')
    .option('-f, --file <path>', 'Output file path')
    .option('--interest', 'Include interest-over-time data', false)
    .parse();

const opts = program.opts();

// Parse time range string to date
function getStartTime(timeStr) {
    const now = Date.now();
    const match = timeStr.match(/^(now|today)\s+(\d+)-([dmy])$/);
    if (!match) return new Date(now - 7 * 24 * 60 * 60 * 1000); // default 7 days

    const [, , num, unit] = match;
    const amount = parseInt(num, 10);
    switch (unit) {
        case 'd': return new Date(now - amount * 24 * 60 * 60 * 1000);
        case 'm': return new Date(now - amount * 30 * 24 * 60 * 60 * 1000);
        case 'y': return new Date(now - amount * 365 * 24 * 60 * 60 * 1000);
        default: return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
}

async function fetchRelatedQueries() {
    const result = await googleTrends.relatedQueries({
        keyword: opts.keyword,
        startTime: getStartTime(opts.time),
        property: opts.property === 'web' ? '' : opts.property,
        category: parseInt(opts.category, 10),
    });
    return JSON.parse(result);
}

async function fetchInterestOverTime() {
    if (!opts.interest) return null;
    const result = await googleTrends.interestOverTime({
        keyword: opts.keyword,
        startTime: getStartTime(opts.time),
        property: opts.property === 'web' ? '' : opts.property,
        category: parseInt(opts.category, 10),
    });
    return JSON.parse(result);
}

function formatTable(data, interest) {
    const lines = [];
    lines.push(`\n[TrendProbe] Searching: "${opts.keyword}" on ${opts.property} (${opts.time})\n`);

    const ranked = data?.default?.rankedList || [];
    ranked.forEach((list, idx) => {
        const label = idx === 0 ? 'Top' : 'Rising';
        lines.push(`--- Related Queries (${label}) ---`);

        (list.rankedKeyword || []).forEach((item, i) => {
            const value = typeof item.value === 'string' ? item.value : item.value;
            const display = item.formattedValue || (value === 'Breakout' ? 'BREAKOUT' : value);
            lines.push(`${i + 1}. ${item.query} (${display})`);
        });
        lines.push('');
    });

    if (interest?.default?.timelineData) {
        lines.push('--- Interest Over Time ---');
        const timeline = interest.default.timelineData.slice(-7); // Last 7 data points
        timeline.forEach(point => {
            lines.push(`${point.formattedTime}: ${point.value[0]}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}

function formatJSON(data, interest) {
    const ranked = data?.default?.rankedList || [];
    const result = {
        keyword: opts.keyword,
        property: opts.property,
        time: opts.time,
        category: opts.category,
        top: (ranked[0]?.rankedKeyword || []).map(q => ({ query: q.query, value: q.value })),
        rising: (ranked[1]?.rankedKeyword || []).map(q => ({ query: q.query, value: q.formattedValue || q.value })),
    };
    if (interest?.default?.timelineData) {
        result.interest = interest.default.timelineData.map(p => ({ time: p.formattedTime, value: p.value[0] }));
    }
    return JSON.stringify(result, null, 2);
}

function formatMarkdown(data, interest) {
    const lines = [];
    lines.push(`## ${opts.keyword} (${opts.property}, ${opts.time})`);
    lines.push('');

    const ranked = data?.default?.rankedList || [];
    if (ranked[0]?.rankedKeyword?.length) {
        lines.push('### Top Queries');
        ranked[0].rankedKeyword.forEach((q, i) => {
            lines.push(`${i + 1}. ${q.query} (${q.value})`);
        });
        lines.push('');
    }

    if (ranked[1]?.rankedKeyword?.length) {
        lines.push('### Rising Queries');
        ranked[1].rankedKeyword.forEach((q, i) => {
            const display = q.formattedValue || q.value;
            lines.push(`${i + 1}. ${q.query} (${display})`);
        });
        lines.push('');
    }

    if (interest?.default?.timelineData) {
        lines.push('### Interest Over Time');
        interest.default.timelineData.slice(-7).forEach(p => {
            lines.push(`- ${p.formattedTime}: ${p.value[0]}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}

async function main() {
    try {
        const [relatedData, interestData] = await Promise.all([
            fetchRelatedQueries(),
            fetchInterestOverTime(),
        ]);

        let output;
        switch (opts.output) {
            case 'json':
                output = formatJSON(relatedData, interestData);
                break;
            case 'markdown':
                output = formatMarkdown(relatedData, interestData);
                break;
            default:
                output = formatTable(relatedData, interestData);
        }

        console.log(output);

        if (opts.file) {
            const fs = await import('fs');
            fs.writeFileSync(opts.file, output, 'utf-8');
            console.log(`\n[Saved to ${opts.file}]`);
        }

    } catch (err) {
        console.error('[Error]', err.message);
        process.exit(1);
    }
}

main();
