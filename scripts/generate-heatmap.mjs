import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const historyPath = path.join(ROOT, 'data', 'gitea-history.json');
const outputPath = path.join(ROOT, 'assets', 'professional-contributions.svg');

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

const firstDate = new Date(`${entries[0].date}T00:00:00Z`);
const lastDate = new Date(`${entries.at(-1).date}T00:00:00Z`);

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

const start = startOfWeek(firstDate);
const end = endOfWeek(lastDate);

const contributionMap = new Map(entries.map(x => [x.date, x.count]));

const allDays = [];

for (
    let d = new Date(start);
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
) {
    const date = d.toISOString().slice(0, 10);

    allDays.push({
        date,
        count: contributionMap.get(date) ?? 0,
        weekday: d.getUTCDay()
    });
}

const maxCount = Math.max(...entries.map(x => x.count), 1);

function level(count) {
    if (count === 0) return 0;

    const ratio = count / maxCount;

    if (ratio <= 0.25) return 1;
    if (ratio <= 0.50) return 2;
    if (ratio <= 0.75) return 3;

    return 4;
}

const cell = 11;
const gap = 3;
const step = cell + gap;

const left = 38;
const top = 42;
const bottom = 42;

const weekCount = Math.ceil(allDays.length / 7);

const width = left + weekCount * step + 20;
const height = top + 7 * step + bottom;

const monthLabels = [];
let previousMonth = -1;

for (let week = 0; week < weekCount; week++) {
    const day = allDays[week * 7];

    if (!day) continue;

    const date = new Date(`${day.date}T00:00:00Z`);
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

const rects = allDays.map((day, index) => {
    const week = Math.floor(index / 7);
    const x = left + week * step;
    const y = top + day.weekday * step;
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
  <text x="${month.x}" y="22" class="month">${month.label}</text>
`).join('');

const totalContributions = entries.reduce(
    (sum, entry) => sum + entry.count,
    0
);

const activeDays = entries.filter(entry => entry.count > 0).length;

const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-labelledby="title desc"
>
  <title id="title">Professional Git contribution history</title>
  <desc id="desc">
    Professional contribution activity archived from Gitea,
    beginning ${entries[0].date}.
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
      text { fill: #8c959f; }

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
    ${totalContributions} contributions · ${activeDays} active days · archived since ${entries[0].date}
  </text>
</svg>
`.trim();

fs.mkdirSync(path.dirname(outputPath), {
    recursive: true
});

fs.writeFileSync(outputPath, svg);

console.log(`Generated ${outputPath}`);
console.log(`From: ${entries[0].date}`);
console.log(`To:   ${entries.at(-1).date}`);
console.log(`Contributions: ${totalContributions}`);
console.log(`Active days: ${activeDays}`);