import { put } from "@vercel/blob";

const MAX_SIZE = 4 * 1024 * 1024;

function getBlobOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (token) {
    return { token };
  }

  const storeId = process.env.BLOB_STORE_ID?.trim();
  const oidcToken =
    process.env.VERCEL_OIDC_TOKEN?.trim();

  if (storeId && oidcToken) {
    return {
      storeId,
      oidcToken
    };
  }

  throw new Error(
    "Vercel Blob chưa được cấu hình. Hãy kiểm tra BLOB_READ_WRITE_TOKEN."
  );
}

async function readRequestBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    total += buffer.length;

    if (total > MAX_SIZE) {
      throw new Error("Ảnh vượt quá giới hạn 4MB.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function createFilename(extension = "png") {
  const now = new Date();

  const date =
    now.getUTCFullYear() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");

  const time =
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0");

  const random =
    Math.random()
      .toString(36)
      .substring(2, 9);

  return `images-${date}-${time}-${random}.${extension}`;
}

function getExtension(contentType) {
  const type =
    String(contentType || "")
      .toLowerCase();

  if (type.includes("jpeg") ||
      type.includes("jpg")) {
    return "jpg";
  }

  if (type.includes("webp")) {
    return "webp";
  }

  if (type.includes("gif")) {
    return "gif";
  }

  if (type.includes("avif")) {
    return "avif";
  }

  return "png";
}

export default async function handler(req, res) {

  /*
   * ================================
   * GET
   * ================================
   */

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      service: "FFVN.TGM IMAGE HOSTING",
      status: "online"
    });
  }

  /*
   * ================================
   * ONLY POST
   * ================================
   */

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {

    /*
     * Kiểm tra Blob trước
     */

    const blobOptions =
      getBlobOptions();

    /*
     * Đọc file trực tiếp
     */

    const buffer =
      await readRequestBody(req);

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        error:
          "Không nhận được dữ liệu hình ảnh."
      });
    }

    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({
        success: false,
        error:
          "Hình ảnh vượt quá giới hạn 4MB."
      });
    }

    /*
     * Content-Type
     */

    const contentType =
      String(
        req.headers["content-type"] ||
        "image/png"
      )
        .split(";")[0]
        .trim()
        .toLowerCase();

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
      "image/avif"
    ];

    if (
      !allowedTypes.includes(contentType)
    ) {
      return res.status(415).json({
        success: false,
        error:
          "Định dạng hình ảnh không được hỗ trợ."
      });
    }

    /*
     * Tên file tự động
     */

    const extension =
      getExtension(contentType);

    const filename =
      createFilename(extension);

    /*
     * Upload Vercel Blob
     */

    const blob =
      await put(
        filename,
        buffer,
        {
          ...blobOptions,

          access: "public",

          addRandomSuffix: false,

          contentType,

          cacheControlMaxAge:
            31536000
        }
      );

    /*
     * Trả URL trực tiếp từ Blob.
     *
     * Không cần gọi API lần 2.
     * Không cần head().
     * Không cần redirect().
     */

    return res.status(200).json({
      success: true,

      message:
        "Upload hình ảnh thành công.",

      filename,

      url: blob.url,

      blobUrl: blob.url,

      pathname:
        blob.pathname,

      contentType,

      size:
        buffer.length
    });

  } catch (error) {

    console.error(
      "FFVN.TGM UPLOAD ERROR:",
      error
    );

    let message =
      error?.message ||
      "Upload hình ảnh thất bại.";

    if (
      message.includes(
        "BLOB_READ_WRITE_TOKEN"
      )
    ) {
      message =
        "Vercel Blob chưa được kết nối với project.";
    }

    return res.status(500).json({
      success: false,
      error: message
    });
  }
}
