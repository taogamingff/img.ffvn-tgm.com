import { put, head } from "@vercel/blob";

const MAX_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif"
];

function getToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token || !token.trim()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN chưa được cấu hình trên Vercel."
    );
  }

  return token.trim();
}

function validateFilename(filename) {
  if (!filename) {
    return false;
  }

  if (!filename.startsWith("images-")) {
    return false;
  }

  if (filename.length > 180) {
    return false;
  }

  /*
    Chỉ cho phép:
    chữ
    số
    -
    _
    .
  */

  return /^[a-zA-Z0-9._-]+$/.test(filename);
}

function getContentType(filename) {

  const lower =
    filename.toLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  if (lower.endsWith(".gif")) {
    return "image/gif";
  }

  if (lower.endsWith(".avif")) {
    return "image/avif";
  }

  return null;
}

async function readBody(req) {

  const chunks = [];

  let total = 0;

  for await (const chunk of req) {

    const buffer =
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);

    total += buffer.length;

    if(total > MAX_SIZE){

      const error =
        new Error(
          "Ảnh vượt quá giới hạn 4MB."
        );

      error.statusCode = 413;

      throw error;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function handleGet(req,res){

  try{

    const rawFilename =
      String(
        req.query?.filename || ""
      );

    const filename =
      rawFilename
        .split("/")
        .pop();

    if(!validateFilename(filename)){

      return res
        .status(400)
        .send("Tên hình ảnh không hợp lệ.");
    }

    const blob =
      await head(
        filename,
        {
          token:getToken()
        }
      );

    if(!blob?.url){

      return res
        .status(404)
        .send("Không tìm thấy hình ảnh.");
    }

    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    /*
      Redirect tới Blob URL thật.
    */

    return res.redirect(
      302,
      blob.url
    );

  }catch(error){

    console.error(
      "GET IMAGE ERROR:",
      error
    );

    return res
      .status(404)
      .send("Không tìm thấy hình ảnh.");
  }
}

async function handlePost(req,res){

  try{

    const token =
      getToken();

    const rawFilename =
      String(
        req.query?.filename || ""
      );

    const filename =
      rawFilename
        .split("/")
        .pop();

    if(!validateFilename(filename)){

      return res.status(400).json({
        success:false,
        error:"Tên hình ảnh không hợp lệ."
      });
    }

    const contentType =
      String(
        req.headers["content-type"] || ""
      )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if(!ALLOWED_TYPES.includes(contentType)){

      return res.status(415).json({
        success:false,
        error:
          "Định dạng hình ảnh không được hỗ trợ."
      });
    }

    /*
      Kiểm tra extension và Content-Type
      phải khớp nhau.
    */

    const expectedType =
      getContentType(filename);

    if(
      expectedType &&
      expectedType !== contentType &&
      !(
        expectedType === "image/jpeg" &&
        contentType === "image/jpg"
      )
    ){

      return res.status(415).json({
        success:false,
        error:
          "Định dạng hình ảnh không khớp."
      });
    }

    const buffer =
      await readBody(req);

    if(!buffer.length){

      return res.status(400).json({
        success:false,
        error:
          "Không nhận được dữ liệu hình ảnh."
      });
    }

    if(buffer.length > MAX_SIZE){

      return res.status(413).json({
        success:false,
        error:
          "Ảnh vượt quá giới hạn 4MB."
      });
    }

    /*
      Upload vào Vercel Blob.
    */

    const blob =
      await put(
        filename,
        buffer,
        {
          token,

          access:"public",

          addRandomSuffix:false,

          contentType,

          cacheControlMaxAge:31536000
        }
      );

    const origin =
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://img-ffvn-tgm-com.vercel.app";

    const publicUrl =
      `${origin}/images/${encodeURIComponent(filename)}`;

    return res.status(200).json({

      success:true,

      message:
        "Upload hình ảnh thành công.",

      filename,

      url:publicUrl,

      blobUrl:blob.url,

      pathname:blob.pathname,

      contentType,

      size:buffer.length
    });

  }catch(error){

    console.error(
      "FFVN.TGM UPLOAD ERROR:",
      error
    );

    return res.status(
      error?.statusCode || 500
    ).json({

      success:false,

      error:
        error?.message ||
        "Upload hình ảnh thất bại."
    });
  }
}

export default async function handler(req,res){

  /*
    GET:
    /api/upload?filename=images-xxx.png

    POST:
    /api/upload?filename=images-xxx.png
  */

  if(req.method === "GET"){

    return handleGet(
      req,
      res
    );
  }

  if(req.method === "POST"){

    return handlePost(
      req,
      res
    );
  }

  res.setHeader(
    "Allow",
    "GET, POST"
  );

  return res.status(405).json({

    success:false,

    error:"Method Not Allowed"
  });
        }
