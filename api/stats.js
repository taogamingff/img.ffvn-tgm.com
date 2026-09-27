const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(process.cwd(), "data", "ob.json");

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function headers() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
  };
}

function toTimestamp(date, time, timezone) {
  if (!date || !time || !timezone) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);

  if (!match || !tm) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  const second = Number(tm[3] || 0);

  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(guess));

    const values = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    const localAtGuess = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    const offset = localAtGuess - guess;

    const wantedLocal = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

    guess = wantedLocal - offset;
  }

  return guess;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers()).end();
  }

  if (req.method !== "GET") {
    return res.status(405).set(headers()).json({
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "Chỉ hỗ trợ GET."
    });
  }

  try {
    const data = loadData();

    const allRecords = [];

    for (const server of Object.values(data.servers)) {
      for (const record of server.records || []) {
        allRecords.push({
          ...record,
          server: server.code,
          timezone: server.timezone
        });
      }
    }

    const uniqueOBs = [
      ...new Set(
        allRecords
          .map(item => Number(item.ob))
          .filter(Number.isFinite)
      )
    ].sort((a, b) => a - b);

    const intervals = [];

    for (const server of Object.values(data.servers)) {
      const records = (server.records || [])
        .filter(r => r.release_date && r.release_time)
        .sort((a, b) => Number(a.ob) - Number(b.ob));

      for (let i = 1; i < records.length; i++) {
        const previous = records[i - 1];
        const current = records[i];

        const previousTime = toTimestamp(
          previous.release_date,
          previous.release_time,
          server.timezone
        );

        const currentTime = toTimestamp(
          current.release_date,
          current.release_time,
          server.timezone
        );

        if (
          previousTime !== null &&
          currentTime !== null &&
          Number(current.ob) > Number(previous.ob)
        ) {
          const obDifference =
            Number(current.ob) - Number(previous.ob);

          const days =
            (currentTime - previousTime) / 86400000;

          if (days > 0) {
            intervals.push({
              days,
              daysPerOB: days / obDifference,
              server: server.code
            });
          }
        }
      }
    }

    const values = intervals.map(x => x.daysPerOB);

    const average =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;

    const minimum =
      values.length > 0 ? Math.min(...values) : null;

    const maximum =
      values.length > 0 ? Math.max(...values) : null;

    const latestOB =
      uniqueOBs.length > 0
        ? uniqueOBs[uniqueOBs.length - 1]
        : null;

    const oldestOB =
      uniqueOBs.length > 0
        ? uniqueOBs[0]
        : null;

    return res.status(200).set(headers()).json({
      success: true,
      stats: {
        total_ob_versions: uniqueOBs.length,
        oldest_ob: oldestOB,
        latest_ob: latestOB,
        interval_samples: intervals.length,
        average_cycle_days:
          average === null ? null : Number(average.toFixed(3)),
        shortest_cycle_days:
          minimum === null ? null : Number(minimum.toFixed(3)),
        longest_cycle_days:
          maximum === null ? null : Number(maximum.toFixed(3)),
        servers_with_data: Object.values(data.servers).filter(
          server => (server.records || []).length > 0
        ).length
      },
      data: {
        source: "configured historical data",
        last_updated: data.last_updated || null
      }
    });
  } catch (error) {
    return res.status(500).set(headers()).json({
      success: false,
      error: "STATS_ERROR",
      message: "Không thể tính thống kê OB."
    });
  }
};
