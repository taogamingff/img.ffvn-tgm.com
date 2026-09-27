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

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return res.status(204).setHeader("Access-Control-Allow-Origin", "*").end();
  }

  if (req.method !== "GET") {
    return res
      .status(405)
      .set(headers())
      .json({
        success: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Chỉ hỗ trợ GET."
      });
  }

  try {
    const data = loadData();

    const servers = Object.values(data.servers).map(server => ({
      code: server.code,
      name: server.name,
      timezone: server.timezone,
      status: server.status,
      notes: server.notes || ""
    }));

    return res.status(200).set(headers()).json({
      success: true,
      count: servers.length,
      servers,
      data: {
        source: "configured-data",
        last_updated: data.last_updated || null
      }
    });
  } catch (error) {
    return res.status(500).set(headers()).json({
      success: false,
      error: "SERVER_DATA_ERROR",
      message: "Không thể đọc dữ liệu server."
    });
  }
};
