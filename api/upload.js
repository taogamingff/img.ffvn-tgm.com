import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};


/*
  Đọc toàn bộ request body
*/
function readRequestBody(req) {

  return new Promise((resolve, reject) => {

    const chunks = [];

    let totalSize = 0;

    const MAX_SIZE = 4 * 1024 * 1024;


    req.on("data", (chunk) => {

      totalSize += chunk.length;

      if (totalSize > MAX_SIZE) {

        reject(
          new Error(
            "Ảnh vượt quá giới hạn 4MB."
          )
        );

        req.destroy();

        return;
      }

      chunks.push(chunk);

    });


    req.on("end", () => {

      resolve(
        Buffer.concat(chunks)
      );

    });


    req.on("error", reject);

  });

}


/*
  API
*/
export default async function handler(req, res) {

  /*
    Chỉ cho phép POST
  */
  if (req.method !== "POST") {

    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({

      success: false,

      error:
        "Method Not Allowed. Hãy sử dụng POST."

    });

  }


  try {

    /*
      Kiểm tra Content-Type
    */
    const contentType =
      req.headers["content-type"] || "";


    if (
      !contentType.includes("image/png")
    ) {

      return res.status(400).json({

        success: false,

        error:
          "API chỉ nhận image/png."

      });

    }


    /*
      Đọc file
    */
    const body =
      await readRequestBody(req);


    if (!body || body.length === 0) {

      return res.status(400).json({

        success: false,

        error:
          "Không nhận được ảnh."

      });

    }


    /*
      Upload lên Vercel Blob
    */
    const blob = await put(
      "images.png",
      body,
      {

        /*
          Public = ai có URL đều có thể mở ảnh
        */
        access: "public",

        /*
          Không tạo tên ngẫu nhiên
        */
        addRandomSuffix: false,

        /*
          Cho phép ghi đè images.png
        */
        allowOverwrite: true,

        /*
          Định dạng file
        */
        contentType: "image/png"

      }
    );


    /*
      Trả URL
    */
    return res.status(200).json({

      success: true,

      filename:
        "images.png",

      url:
        blob.url

    });


  } catch (error) {

    console.error(
      "UPLOAD ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Upload thất bại."

    });

  }

      }
