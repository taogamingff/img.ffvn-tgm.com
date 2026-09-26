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

function getToken(){

    const token =
        process.env.BLOB_READ_WRITE_TOKEN;

    if(!token){

        throw new Error(
            "BLOB_READ_WRITE_TOKEN chưa được cấu hình trên Vercel."
        );
    }

    return token.trim();
}

function validFilename(filename){

    if(
        typeof filename !== "string" ||
        !filename
    ){
        return false;
    }

    /*
      Cho phép:

      a7K29xPq.png
      X92kLm3A.webp
      8KxP2mQ1.gif
    */

    return /^[A-Za-z0-9]{8,12}\.(png|jpg|jpeg|webp|gif|avif)$/i
        .test(filename);
}

function getExpectedType(filename){

    const extension =
        filename
            .split(".")
            .pop()
            .toLowerCase();

    switch(extension){

        case "png":
            return "image/png";

        case "jpg":
        case "jpeg":
            return "image/jpeg";

        case "webp":
            return "image/webp";

        case "gif":
            return "image/gif";

        case "avif":
            return "image/avif";

        default:
            return null;
    }
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

        const rawFilename =
            String(
                req.query?.filename || ""
            );

        const filename =
            rawFilename
                .split("/")
                .pop();

        /*
        ========================================
        GET IMAGE
        /images/a7K29xPq.png
        ========================================
        */

        if(req.method === "GET"){

            if(!validFilename(filename)){

                return res
                    .status(400)
                    .send(
                        "Tên hình ảnh không hợp lệ."
                    );
            }

            const blob =
                await head(
                    filename,
                    {
                        token:getToken()
                    }
                );

            if(!blob || !blob.url){

                return res
                    .status(404)
                    .send(
                        "Không tìm thấy hình ảnh."
                    );
            }

            /*
              Cache ảnh trong 1 năm.
            */

            res.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable"
            );

            res.setHeader(
                "Content-Type",
                blob.contentType ||
                getExpectedType(filename) ||
                "application/octet-stream"
            );

            /*
              Chuyển tới Blob URL thật.
            */

            return res.redirect(
                302,
                blob.url
            );
        }

        /*
        ========================================
        POST UPLOAD
        ========================================
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

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "Tên file không hợp lệ."
                });
        }

        const contentType =
            String(
                req.headers["content-type"] || ""
            )
            .split(";")[0]
            .trim()
            .toLowerCase();

        if(
            !ALLOWED_TYPES.includes(
                contentType
            )
        ){

            return res
                .status(415)
                .json({
                    success:false,
                    error:
                        "Định dạng hình ảnh không được hỗ trợ."
                });
        }

        const expectedType =
            getExpectedType(filename);

        if(
            expectedType &&
            contentType !== expectedType &&
            !(
                expectedType === "image/jpeg" &&
                contentType === "image/jpg"
            )
        ){

            return res
                .status(415)
                .json({
                    success:false,
                    error:
                        "Định dạng file không khớp."
                });
        }

        const buffer =
            await readBody(req);

        if(!buffer.length){

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "Không nhận được dữ liệu hình ảnh."
                });
        }

        /*
          Upload Blob.
        */

        const blob =
            await put(
                filename,
                buffer,
                {
                    token:getToken(),

                    access:"public",

                    /*
                      Không tự thêm suffix.
                      Filename đã ngắn và duy nhất
                      do trình duyệt tạo.
                    */

                    addRandomSuffix:false,

                    contentType,

                    cacheControlMaxAge:
                        31536000
                }
            );

        const domain =
            "https://img-ffvn-tgm-com.vercel.app";

        const publicUrl =
            domain +
            "/images/" +
            encodeURIComponent(filename);

        return res
            .status(200)
            .json({

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
            "FFVN.TGM API ERROR:",
            error
        );

        return res
            .status(
                error?.statusCode || 500
            )
            .json({

                success:false,

                error:
                    error?.message ||
                    "Máy chủ xử lý thất bại."
            });
    }
}
