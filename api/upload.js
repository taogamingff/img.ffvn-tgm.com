import { put, head } from "@vercel/blob";

const MAX_SIZE = 4 * 1024 * 1024;

const DOMAIN =
  "https://img-ffvn-tgm-com.vercel.app";

function blobOptions() {
  const token =
    process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN chưa được cấu hình."
    );
  }

  return {
    token
  };
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

function createFilename() {
  const now = new Date();

  const yyyy =
    now.getUTCFullYear();

  const mm =
    String(now.getUTCMonth() + 1)
      .padStart(2, "0");

  const dd =
    String(now.getUTCDate())
      .padStart(2, "0");

  const hh =
    String(now.getUTCHours())
      .padStart(2, "0");

  const mi =
    String(now.getUTCMinutes())
      .padStart(2, "0");

  const ss =
    String(now.getUTCSeconds())
      .padStart(2, "0");

  const random =
    Math.random()
      .toString(36)
      .substring(2, 8);

  return `images-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${random}.png`;
}

export default async function handler(req, res) {

  /*
   * =========================
   * GET IMAGE
   * =========================
   */

  if (req.method === "GET") {

    try {

      const filename =
        String(
          req.query?.filename || ""
        )
          .split("/")
          .pop();

      if (
        !filename ||
        !filename.startsWith("images-") ||
        !filename.endsWith(".png")
      ) {
        return res
          .status(400)
          .send("Invalid image name");
      }

      const blob =
        await head(
          filename,
          blobOptions()
        );

      if (!blob?.url) {
        return res
          .status(404)
          .send("Image not found");
      }

      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable"
      );

      return res.redirect(
        302,
        blob.url
      );

    } catch (error) {

      console.error(
        "IMAGE ERROR:",
        error
      );

      return res
        .status(404)
        .send("Image not found");
    }
  }

  /*
   * =========================
   * ONLY POST
   * =========================
   */

  if (req.method !== "POST") {

    res.setHeader(
      "Allow",
      "POST, GET"
    );

    return res
      .status(405)
      .json({
        success: false,
        error: "Method Not Allowed"
      });
  }

  try {

    /*
     * Đọc ảnh trực tiếp
     * Không dùng multipart
     * Không dùng formData
     */

    const buffer =
      await readBody(req);

    if (!buffer.length) {

      return res
        .status(400)
        .json({
          success: false,
          error:
            "Không nhận được dữ liệu ảnh."
        });
    }

    if (
      buffer.length >
      MAX_SIZE
    ) {

      return res
        .status(413)
        .json({
          success: false,
          error:
            "Ảnh vượt quá giới hạn 4MB."
        });
    }

    /*
     * Tạo tên mới
     */

    const filename =
      createFilename();

    /*
     * Upload Blob
     */

    const blob =
      await put(
        filename,
        buffer,
        {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          cacheControlMaxAge:
            31536000,
          ...blobOptions()
        }
      );

    /*
     * URL website
     */

    const imageUrl =
      `${DOMAIN}/images/${filename}`;

    return res
      .status(200)
      .json({
        success: true,

        filename,

        url: imageUrl,

        blobUrl: blob.url,

        pathname:
          blob.pathname,

        contentType:
          "image/png",

        size:
          buffer.length
      });

  } catch (error) {

    console.error(
      "UPLOAD ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        error:
          error?.message ||
          "Upload thất bại."
      });
  }
}
