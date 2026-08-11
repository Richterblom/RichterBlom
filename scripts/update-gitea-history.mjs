import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const initialBackupPath = path.join(
    ROOT,
    'data',
    'gitea-initial-backup.json'
);

const historyPath = path.join(
    ROOT,
    'data',
    'gitea-history.json'
);

const GITEA_URL = 'https://git.cagan.tech';
const GITEA_USERNAME = 'Richter';

function toLocalDate(timestamp) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(timestamp * 1000));
}

function mergeEntries(history, entries) {
    for (const entry of entries) {
        const date = toLocalDate(entry.timestamp);
        const count = Number(entry.contributions ?? 0);

        history[date] = (history[date] ?? 0) + count;
    }

    return history;
}

function loadJson(file, fallback) {
    if (!fs.existsSync(file)) {
        return fallback;
    }

    const content = fs
        .readFileSync(file, 'utf8')
        .replace(/^\uFEFF/, '');

    return JSON.parse(content);
}

async function fetchCurrentHeatmap() {
    const token = process.env.GITEA_TOKEN;

    if (!token) {
        return [];
    }

    const response = await fetch(
        `${GITEA_URL}/api/v1/users/${GITEA_USERNAME}/heatmap`,
        {
            headers: {
                Authorization: `token ${token}`
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `Gitea request failed: ${response.status} ${response.statusText}`
        );
    }

    return response.json();
}

const existingHistory = loadJson(historyPath, {});

if (
    Object.keys(existingHistory).length === 0 &&
    fs.existsSync(initialBackupPath)
) {
    const initialEntries = loadJson(initialBackupPath, []);
    mergeEntries(existingHistory, initialEntries);
}

const currentEntries = await fetchCurrentHeatmap();

const currentDaily = {};
mergeEntries(currentDaily, currentEntries);

for (const [date, count] of Object.entries(currentDaily)) {
    existingHistory[date] = count;
}

const sorted = Object.fromEntries(
    Object.entries(existingHistory).sort(([a], [b]) =>
        a.localeCompare(b)
    )
);

fs.writeFileSync(
    historyPath,
    JSON.stringify(sorted, null, 2) + '\n'
);

console.log(
    `Stored ${Object.keys(sorted).length} contribution days.`
);