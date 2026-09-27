function headers() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
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

  return res.status(200).set(headers()).json({
    success: true,
    status: "online",
    service: "FF OB Prediction API",
    timestamp: new Date().toISOString()
  });
};
