import { put, head } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: "10mb"
  }
};

const MAX_SIZE = 4 * 1024 * 1024;

const DOMAIN =
  "https://img-ffvn-tgm-com.vercel.app";


/*
|--------------------------------------------------------------------------
| Đọc raw body
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Blob credentials
|--------------------------------------------------------------------------
*/

function getBlobOptions() {

  const storeId =
    process.env.BLOB_STORE_ID?.trim();

  const oidcToken =
    process.env.VERCEL_OIDC_TOKEN?.trim();

  const token =
    process.env.BLOB_READ_WRITE_TOKEN?.trim();


  /*
  |--------------------------------------------------------------------------
  | OIDC
  |--------------------------------------------------------------------------
  */

  if (storeId) {

    const options = {
      storeId
    };

    if (oidcToken) {
      options.oidcToken = oidcToken;
    }

    return options;
  }


  /*
  |--------------------------------------------------------------------------
  | Token fallback
  |--------------------------------------------------------------------------
  */

  if (token) {

    return {
      token
    };

  }


  throw new Error(
    "Không tìm thấy Vercel Blob credentials. " +
    "Kiểm tra BLOB_STORE_ID hoặc BLOB_READ_WRITE_TOKEN."
  );

}


/*
|--------------------------------------------------------------------------
| Tạo tên ảnh
|--------------------------------------------------------------------------
|
| images-YYYYMMDD-HHMMSS-random.png
|
*/

function createFilename() {

  const now =
    new Date();

  const year =
    now.getUTCFullYear();

  const month =
    String(
      now.getUTCMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getUTCDate()
    ).padStart(2, "0");

  const hour =
    String(
      now.getUTCHours()
    ).padStart(2, "0");

  const minute =
    String(
      now.getUTCMinutes()
    ).padStart(2, "0");

  const second =
    String(
      now.getUTCSeconds()
    ).padStart(2, "0");

  const random =
    Math.random()
      .toString(36)
      .slice(2, 8);

  return (
    `images-${year}` +
    `${month}` +
    `${day}-` +
    `${hour}` +
    `${minute}` +
    `${second}-` +
    `${random}.png`
  );

}


/*
|--------------------------------------------------------------------------
| GET IMAGE
|--------------------------------------------------------------------------
|
| /images/filename.png
|
*/

export default async function handler(
  req,
  res
) {

  /*
  |--------------------------------------------------------------------------
  | GET
  |--------------------------------------------------------------------------
  */

  if (req.method === "GET") {

    try {

      const filename =
        req.query?.filename;


      if (!filename) {

        return res
          .status(400)
          .send(
            "Thiếu tên ảnh."
          );

      }


      const cleanName =
        String(filename)
          .replace(/^\/+/, "")
          .trim();


      if (
        !cleanName ||
        !cleanName.endsWith(".png") ||
        cleanName.includes("..") ||
        cleanName.includes("/")
      ) {

        return res
          .status(400)
          .send(
            "Tên ảnh không hợp lệ."
          );

      }


      /*
      |--------------------------------------------------------------------------
      | Tìm Blob
      |--------------------------------------------------------------------------
      */

      const options =
        getBlobOptions();


      const blob =
        await head(
          cleanName,
          options
        );


      /*
      |--------------------------------------------------------------------------
      | Redirect đến Blob public URL
      |--------------------------------------------------------------------------
      |
      | Không cần proxy toàn bộ file qua Function.
      | Điều này giúp ảnh tải nhanh hơn.
      |
      */

      return res.redirect(
        302,
        blob.url
      );


    } catch (error) {

      console.error(
        "GET IMAGE ERROR:",
        error
      );


      return res
        .status(404)
        .send(
          "Image not found."
        );

    }

  }


  /*
  |--------------------------------------------------------------------------
  | POST UPLOAD
  |--------------------------------------------------------------------------
  */

  if (req.method !== "POST") {

    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return res
      .status(405)
      .json({

        success: false,

        error:
          "Method Not Allowed"

      });

  }


  try {

    /*
    |--------------------------------------------------------------------------
    | Đọc ảnh
    |--------------------------------------------------------------------------
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


    /*
    |--------------------------------------------------------------------------
    | Giới hạn 4MB
    |--------------------------------------------------------------------------
    */

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
    |--------------------------------------------------------------------------
    | Tạo tên riêng
    |--------------------------------------------------------------------------
    */

    const filename =
      createFilename();


    /*
    |--------------------------------------------------------------------------
    | Credentials
    |--------------------------------------------------------------------------
    */

    const blobOptions =
      getBlobOptions();


    /*
    |--------------------------------------------------------------------------
    | Upload
    |--------------------------------------------------------------------------
    */

    const blob =
      await put(
        filename,
        buffer,
        {

          access:
            "public",

          addRandomSuffix:
            false,

          contentType:
            "image/png",

          cacheControlMaxAge:
            31536000,

          ...blobOptions

        }
      );


    /*
    |--------------------------------------------------------------------------
    | URL website
    |--------------------------------------------------------------------------
    */

    const imageUrl =
      `${DOMAIN}/${filename}`;


    /*
    |--------------------------------------------------------------------------
    | Kết quả
    |--------------------------------------------------------------------------
    */

    return res
      .status(200)
      .json({

        success:
          true,

        url:
          imageUrl,

        blobUrl:
          blob.url,

        pathname:
          blob.pathname,

        filename,

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

        success:
          false,

        error:
          error?.message ||
          "Upload thất bại."

      });

  }

}
