import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const historyPath = path.join(ROOT, 'data', 'gitea-history.json');
const assetsPath = path.join(ROOT, 'assets');

const history = JSON.parse(
    fs.readFileSync(historyPath, 'utf8').replace(/^\uFEFF/, '')
);

const entries = Object.entries(history)
    .map(([date, count]) => ({
        date,
        count: Number(count ?? 0)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

if (entries.length === 0) {
    throw new Error('No contribution history found.');
}

fs.mkdirSync(assetsPath, {recursive: true});

const groupedByYear = new Map();

for (const entry of entries) {
    const year = entry.date.slice(0, 4);

    if (!groupedByYear.has(year)) {
        groupedByYear.set(year, []);
    }

    groupedByYear.get(year).push(entry);
}

function dateKey(date) {
    return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d;
}

function endOfWeek(date) {
    const d = startOfWeek(date);
    d.setUTCDate(d.getUTCDate() + 6);
    return d;
}

function generateYearHeatmap(year, yearEntries) {
    const contributionMap = new Map(
        yearEntries.map(entry => [entry.date, entry.count])
    );

    const yearStart = new Date(`${year}-01-01T00:00:00Z`);
    const yearEnd = new Date(`${year}-12-31T00:00:00Z`);

    const start = startOfWeek(yearStart);
    const end = endOfWeek(yearEnd);

    const days = [];

    for (
        let d = new Date(start);
        d <= end;
        d.setUTCDate(d.getUTCDate() + 1)
    ) {
        const date = dateKey(d);

        days.push({
            date,
            count: contributionMap.get(date) ?? 0,
            weekday: d.getUTCDay(),
            inYear: d.getUTCFullYear().toString() === year
        });
    }

    const positiveCounts = yearEntries
        .map(entry => entry.count)
        .filter(count => count > 0)
        .sort((a, b) => a - b);

    function level(count) {
        if (count <= 0) return 0;

        if (positiveCounts.length === 0) {
            return 0;
        }

        const max = positiveCounts.at(-1);

        if (max <= 4) {
            return Math.min(count, 4);
        }

        const ratio = count / max;

        if (ratio <= 0.25) return 1;
        if (ratio <= 0.50) return 2;
        if (ratio <= 0.75) return 3;

        return 4;
    }

    const cell = 11;
    const gap = 3;
    const step = cell + gap;

    const left = 36;
    const top = 34;
    const bottom = 42;

    const weekCount = Math.ceil(days.length / 7);

    const width = left + weekCount * step + 20;
    const height = top + 7 * step + bottom;

    const monthLabels = [];
    let previousMonth = -1;

    for (let week = 0; week < weekCount; week++) {
        const weekDays = days.slice(week * 7, week * 7 + 7);

        const firstInYear = weekDays.find(day => day.inYear);

        if (!firstInYear) {
            continue;
        }

        const date = new Date(`${firstInYear.date}T00:00:00Z`);
        const month = date.getUTCMonth();

        if (month !== previousMonth) {
            monthLabels.push({
                x: left + week * step,
                label: date.toLocaleString('en-US', {
                    month: 'short',
                    timeZone: 'UTC'
                })
            });

            previousMonth = month;
        }
    }

    const rects = days.map((day, index) => {
        const week = Math.floor(index / 7);
        const x = left + week * step;
        const y = top + day.weekday * step;

        if (!day.inYear) {
            return '';
        }

        const contributionLevel = level(day.count);

        return `
      <rect
        x="${x}"
        y="${y}"
        width="${cell}"
        height="${cell}"
        rx="2"
        class="level-${contributionLevel}"
      >
        <title>${day.date}: ${day.count} contribution${day.count === 1 ? '' : 's'}</title>
      </rect>
    `;
    }).join('');

    const months = monthLabels.map(month => `
    <text x="${month.x}" y="18" class="month">${month.label}</text>
  `).join('');

    const totalContributions = yearEntries.reduce(
        (sum, entry) => sum + entry.count,
        0
    );

    const activeDays = yearEntries.filter(
        entry => entry.count > 0
    ).length;

    const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-labelledby="title desc"
>
  <title id="title">${year} professional Git contribution history</title>

  <desc id="desc">
    Professional Git contribution activity archived for ${year}.
  </desc>

  <style>
    text {
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Helvetica,
        Arial,
        sans-serif;
      font-size: 10px;
      fill: #57606a;
    }

    .level-0 { fill: #ebedf0; }
    .level-1 { fill: #9be9a8; }
    .level-2 { fill: #40c463; }
    .level-3 { fill: #30a14e; }
    .level-4 { fill: #216e39; }

    @media (prefers-color-scheme: dark) {
      text {
        fill: #8c959f;
      }

      .level-0 { fill: #161b22; }
      .level-1 { fill: #0e4429; }
      .level-2 { fill: #006d32; }
      .level-3 { fill: #26a641; }
      .level-4 { fill: #39d353; }
    }
  </style>

  ${months}

  <text x="0" y="${top + step + 8}">Mon</text>
  <text x="0" y="${top + step * 3 + 8}">Wed</text>
  <text x="0" y="${top + step * 5 + 8}">Fri</text>

  ${rects}

  <text x="${left}" y="${height - 12}">
    ${totalContributions} contributions · ${activeDays} active days
  </text>
</svg>
`.trim();

    const outputPath = path.join(
        assetsPath,
        `professional-contributions-${year}.svg`
    );

    fs.writeFileSync(outputPath, svg);

    console.log(
        `${year}: ${totalContributions} contributions across ${activeDays} active days`
    );
}

for (const [year, yearEntries] of groupedByYear) {
    generateYearHeatmap(year, yearEntries);
}

console.log(
    `Generated ${groupedByYear.size} yearly heatmap(s).`
);