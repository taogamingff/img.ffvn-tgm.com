import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: "6mb"
  }
};


/*
|--------------------------------------------------------------------------
| URL cố định của website
|--------------------------------------------------------------------------
*/

const PUBLIC_URL =
  "https://img-ffvn-tgm-com.vercel.app/images.png";


/*
|--------------------------------------------------------------------------
| URL Blob hiện tại
|--------------------------------------------------------------------------
|
| Đây là URL Blob thật đang chứa images.png.
|
*/

const BLOB_URL =
  "https://qgsepgnqgymmbrtx.public.blob.vercel-storage.com/images.png";


/*
|--------------------------------------------------------------------------
| Giới hạn ảnh
|--------------------------------------------------------------------------
*/

const MAX_SIZE =
  4 * 1024 * 1024;


/*
|--------------------------------------------------------------------------
| Đọc raw request body
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
| Kiểm tra Blob credentials
|--------------------------------------------------------------------------
|
| Ưu tiên:
|
| OIDC:
|   VERCEL_OIDC_TOKEN
|   +
|   BLOB_STORE_ID
|
| Fallback:
|
|   BLOB_READ_WRITE_TOKEN
|
|--------------------------------------------------------------------------
*/

function getBlobOptions() {

  const storeId =
    process.env.BLOB_STORE_ID?.trim();

  const oidcToken =
    process.env.VERCEL_OIDC_TOKEN?.trim();

  const readWriteToken =
    process.env.BLOB_READ_WRITE_TOKEN?.trim();


  /*
  |--------------------------------------------------------------------------
  | OIDC
  |--------------------------------------------------------------------------
  |
  | Khi chạy trên Vercel, @vercel/blob có thể tự lấy
  | Vercel OIDC token.
  |
  */

  if (storeId) {

    const options = {
      storeId
    };


    /*
    | Nếu VERCEL_OIDC_TOKEN tồn tại thì truyền rõ ràng.
    */

    if (oidcToken) {

      options.oidcToken =
        oidcToken;

    }


    return options;

  }


  /*
  |--------------------------------------------------------------------------
  | Token cũ
  |--------------------------------------------------------------------------
  */

  if (readWriteToken) {

    return {
      token:
        readWriteToken
    };

  }


  /*
  |--------------------------------------------------------------------------
  | Không có credential
  |--------------------------------------------------------------------------
  */

  throw new Error(
    "Không tìm thấy Vercel Blob credentials. " +
    "Hãy kết nối Blob Store với project hoặc kiểm tra " +
    "BLOB_STORE_ID / VERCEL_OIDC_TOKEN / BLOB_READ_WRITE_TOKEN."
  );

}


/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

export default async function handler(req, res) {


  /*
  |--------------------------------------------------------------------------
  | GET
  |--------------------------------------------------------------------------
  |
  | /images.png
  |
  */

  if (req.method === "GET") {

    try {

      const response =
        await fetch(
          BLOB_URL,
          {
            cache: "no-store"
          }
        );


      if (!response.ok) {

        return res
          .status(response.status)
          .send("Image not found");

      }


      const contentType =
        response.headers.get(
          "content-type"
        ) ||
        "image/png";


      const arrayBuffer =
        await response.arrayBuffer();


      const buffer =
        Buffer.from(
          arrayBuffer
        );


      res.setHeader(
        "Content-Type",
        contentType
      );


      res.setHeader(
        "Content-Length",
        buffer.length
      );


      /*
      |--------------------------------------------------------------------------
      | Cache ngắn
      |--------------------------------------------------------------------------
      */

      res.setHeader(
        "Cache-Control",
        "public, max-age=60, s-maxage=60"
      );


      return res
        .status(200)
        .send(buffer);


    } catch (error) {

      console.error(
        "IMAGE ERROR:",
        error
      );


      return res
        .status(500)
        .send("Cannot load image");

    }

  }


  /*
  |--------------------------------------------------------------------------
  | Chỉ cho POST upload
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
    | Kiểm tra kích thước
    |--------------------------------------------------------------------------
    */

    if (buffer.length > MAX_SIZE) {

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
    | Lấy credential
    |--------------------------------------------------------------------------
    */

    const blobOptions =
      getBlobOptions();


    /*
    |--------------------------------------------------------------------------
    | Upload Vercel Blob
    |--------------------------------------------------------------------------
    */

    const blob =
      await put(
        "images.png",
        buffer,
        {

          /*
          | Ảnh công khai
          */

          access:
            "public",


          /*
          | Không thêm chuỗi ngẫu nhiên
          */

          addRandomSuffix:
            false,


          /*
          | Cho phép ghi đè images.png
          */

          allowOverwrite:
            true,


          /*
          | Luôn lưu dưới dạng PNG
          */

          contentType:
            "image/png",


          /*
          | Cache 60 giây
          */

          cacheControlMaxAge:
            60,


          /*
          | Credential OIDC/token
          */

          ...blobOptions

        }
      );


    /*
    |--------------------------------------------------------------------------
    | Upload thành công
    |--------------------------------------------------------------------------
    */

    return res
      .status(200)
      .json({

        success:
          true,

        /*
        | URL mà người dùng cần
        */

        url:
          PUBLIC_URL,

        /*
        | URL Blob thật
        */

        blobUrl:
          blob.url,

        pathname:
          blob.pathname,

        contentType:
          blob.contentType ||
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
