import { put, head } from "@vercel/blob";

const DOMAIN = "https://img-ffvn-tgm-com.vercel.app";
const MAX_SIZE = 4 * 1024 * 1024;

function getBlobOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN chưa được cấu hình trên Vercel."
    );
  }

  return { token };
}

function getExtension(contentType) {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("jpeg") || type.includes("jpg")) {
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

function createFilename(extension) {
  const now = new Date();

  const date =
    now.getUTCFullYear() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");

  const time =
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0");

  const random = Math.random()
    .toString(36)
    .substring(2, 9);

  return `images-${date}-${time}-${random}.${extension}`;
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
      const error = new Error(
        "Ảnh vượt quá giới hạn 4MB."
      );

      error.statusCode = 413;
      throw error;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {

  /*
   * ==================================================
   * GET /images/filename
   * ==================================================
   */

  if (req.method === "GET") {
    try {
      const filename = String(
        req.query?.filename || ""
      )
        .split("/")
        .pop();

      if (
        !filename ||
        !filename.startsWith("images-")
      ) {
        return res.status(400).send(
          "Tên hình ảnh không hợp lệ."
        );
      }

      const blob = await head(
        filename,
        getBlobOptions()
      );

      if (!blob?.url) {
        return res.status(404).send(
          "Không tìm thấy hình ảnh."
        );
      }

      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable"
      );

      return res.redirect(302, blob.url);

    } catch (error) {
      console.error(
        "GET IMAGE ERROR:",
        error
      );

      return res.status(404).send(
        "Không tìm thấy hình ảnh."
      );
    }
  }


  /*
   * ==================================================
   * POST /api/upload
   * ==================================================
   */

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }


  try {
    const blobOptions =
      getBlobOptions();

    const contentType =
      String(
        req.headers["content-type"] ||
        ""
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
          "Ảnh vượt quá giới hạn 4MB."
      });
    }


    const extension =
      getExtension(contentType);


    const filename =
      createFilename(extension);


    /*
     * Upload vào Vercel Blob
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
     * Link người dùng nhìn thấy
     */

    const publicUrl =
      `${DOMAIN}/images/${encodeURIComponent(
        filename
      )}`;


    return res.status(200).json({
      success: true,

      message:
        "Upload hình ảnh thành công.",

      filename,

      url: publicUrl,

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
