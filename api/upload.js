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

function token(){

  const value =
    process.env.BLOB_READ_WRITE_TOKEN;

  if(!value){
    throw new Error(
      "BLOB_READ_WRITE_TOKEN chưa được cấu hình."
    );
  }

  return value.trim();
}

function validFilename(name){

  return (
    typeof name === "string" &&
    name.startsWith("images-") &&
    name.length < 200 &&
    /^[A-Za-z0-9._-]+$/.test(name)
  );
}

async function readBody(req){

  const chunks = [];

  let total = 0;

  for await(const chunk of req){

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

export default async function handler(req,res){

  try{

    const filename =
      String(
        req.query?.filename || ""
      )
      .split("/")
      .pop();

    /*
      GET /api/upload?filename=...
      Dùng để mở ảnh sau khi upload.
    */

    if(req.method === "GET"){

      if(!validFilename(filename)){

        return res
          .status(400)
          .send("Tên ảnh không hợp lệ.");
      }

      const blob =
        await head(
          filename,
          {
            token:token()
          }
        );

      if(!blob?.url){

        return res
          .status(404)
          .send("Không tìm thấy ảnh.");
      }

      res.setHeader(
        "Cache-Control",
        "public,max-age=31536000,immutable"
      );

      return res.redirect(
        302,
        blob.url
      );
    }

    /*
      POST upload.
    */

    if(req.method !== "POST"){

      res.setHeader(
        "Allow",
        "GET, POST"
      );

      return res
        .status(405)
        .json({
          success:false,
          error:"Method Not Allowed"
        });
    }

    if(!validFilename(filename)){

      return res.status(400).json({
        success:false,
        error:"Tên ảnh không hợp lệ."
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
          "Định dạng ảnh không được hỗ trợ."
      });
    }

    const buffer =
      await readBody(req);

    if(!buffer.length){

      return res.status(400).json({
        success:false,
        error:
          "Không nhận được dữ liệu ảnh."
      });
    }

    const blob =
      await put(
        filename,
        buffer,
        {
          token:token(),
          access:"public",
          addRandomSuffix:false,
          contentType,
          cacheControlMaxAge:31536000
        }
      );

    const domain =
      "https://img-ffvn-tgm-com.vercel.app";

    const url =
      `${domain}/images/${encodeURIComponent(filename)}`;

    return res.status(200).json({

      success:true,

      filename,

      url,

      blobUrl:blob.url,

      pathname:blob.pathname,

      contentType,

      size:buffer.length
    });

  }catch(error){

    console.error(
      "FFVN.TGM API ERROR:",
      error
    );

    return res.status(
      error?.statusCode || 500
    ).json({

      success:false,

      error:
        error?.message ||
        "Máy chủ xử lý thất bại."
    });
  }
}
