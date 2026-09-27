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

function normalizeRecord(server, record) {
  return {
    server: server.code,
    server_name: server.name,
    timezone: server.timezone,
    ob: Number(record.ob),
    previous_ob:
      record.previous_ob === undefined || record.previous_ob === null
        ? null
        : Number(record.previous_ob),
    release_date: record.release_date || null,
    release_time: record.release_time || null,
    source: record.source || "configured-data",
    status: record.status || "UNKNOWN",
    notes: record.notes || ""
  };
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

    let limit = Number(req.query.limit || 0);

    if (!Number.isFinite(limit) || limit < 0) {
      limit = 0;
    }

    if (limit > 1000) {
      limit = 1000;
    }

    const serverFilter = req.query.server
      ? String(req.query.server).toLowerCase()
      : null;

    let history = [];

    for (const server of Object.values(data.servers)) {
      if (serverFilter && server.code !== serverFilter) {
        continue;
      }

      for (const record of server.records || []) {
        history.push(normalizeRecord(server, record));
      }
    }

    history.sort((a, b) => {
      if (a.ob !== b.ob) return b.ob - a.ob;
      return a.server.localeCompare(b.server);
    });

    if (limit > 0) {
      history = history.slice(0, limit);
    }

    return res.status(200).set(headers()).json({
      success: true,
      count: history.length,
      history,
      data: {
        source: "configured historical data",
        last_updated: data.last_updated || null
      }
    });
  } catch (error) {
    return res.status(500).set(headers()).json({
      success: false,
      error: "HISTORY_DATA_ERROR",
      message: "Không thể đọc lịch sử OB."
    });
  }
};
