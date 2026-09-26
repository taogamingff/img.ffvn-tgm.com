import { put, get } from "@vercel/blob";

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
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if(!token){
        throw new Error(
            "BLOB_READ_WRITE_TOKEN chưa được cấu hình."
        );
    }

    return token.trim();
}

function isValidFilename(filename){

    if(typeof filename !== "string"){
        return false;
    }

    return /^[A-Za-z0-9]{8}\.(png|jpg|webp|gif|avif)$/i
        .test(filename);
}

function getContentType(filename){

    const ext =
        filename
            .split(".")
            .pop()
            .toLowerCase();

    switch(ext){

        case "png":
            return "image/png";

        case "jpg":
            return "image/jpeg";

        case "webp":
            return "image/webp";

        case "gif":
            return "image/gif";

        case "avif":
            return "image/avif";

        default:
            return "application/octet-stream";
    }
}

async function readRequestBody(req){

    const chunks = [];

    let total = 0;

    for await(const chunk of req){

        const buffer =
            Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(chunk);

        total += buffer.length;

        if(total > MAX_SIZE){

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

export default async function handler(req,res){

    try{

        const rawFilename =
            String(req.query?.filename || "");

        const filename =
            rawFilename.split("/").pop();

        /*
         * GET
         * /images/a7K29xPq.png
         *
         * Không redirect sang URL Blob.
         * Lấy Blob bằng get() và stream trực tiếp.
         */

        if(req.method === "GET"){

            if(!isValidFilename(filename)){

                return res
                    .status(400)
                    .send("Tên ảnh không hợp lệ.");
            }

            const result = await get(
                filename,
                {
                    access:"public",
                    token:getToken()
                }
            );

            if(
                !result ||
                !result.stream
            ){

                return res
                    .status(404)
                    .send("Không tìm thấy hình ảnh.");
            }

            const contentType =
                result.blob?.contentType ||
                getContentType(filename);

            res.statusCode = 200;

            res.setHeader(
                "Content-Type",
                contentType
            );

            res.setHeader(
                "Content-Disposition",
                "inline"
            );

            res.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable"
            );

            /*
             * Node/Vercel có thể xử lý stream.
             */

            if(
                typeof result.stream.pipe === "function"
            ){

                result.stream.pipe(res);

                return;
            }

            /*
             * Fallback nếu stream là Web ReadableStream.
             */

            const response =
                new Response(
                    result.stream,
                    {
                        status:200,
                        headers:{
                            "Content-Type":
                                contentType,
                            "Content-Disposition":
                                "inline",
                            "Cache-Control":
                                "public, max-age=31536000, immutable"
                        }
                    }
                );

            const arrayBuffer =
                await response.arrayBuffer();

            res.end(
                Buffer.from(arrayBuffer)
            );

            return;
        }

        /*
         * POST
         * Upload ảnh.
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

        if(!isValidFilename(filename)){

            return res
                .status(400)
                .json({
                    success:false,
                    error:"Tên file không hợp lệ."
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

            return res
                .status(415)
                .json({
                    success:false,
                    error:
                        "Định dạng ảnh không được hỗ trợ."
                });
        }

        const buffer =
            await readRequestBody(req);

        if(!buffer.length){

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "Không nhận được dữ liệu ảnh."
                });
        }

        /*
         * Lưu vào Vercel Blob.
         */

        await put(
            filename,
            buffer,
            {
                token:getToken(),
                access:"public",
                addRandomSuffix:false,
                contentType:contentType,
                cacheControlMaxAge:31536000
            }
        );

        const publicUrl =
            "https://img-ffvn-tgm-com.vercel.app/images/" +
            encodeURIComponent(filename);

        /*
         * CỐ Ý KHÔNG TRẢ:
         * blobUrl
         * pathname
         *
         * Chỉ trả URL website của bạn.
         */

        return res
            .status(200)
            .json({
                success:true,
                filename:filename,
                url:publicUrl,
                contentType:contentType,
                size:buffer.length
            });

    }catch(error){

        console.error(
            "FFVN.TGM UPLOAD ERROR:",
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
                    "Lỗi máy chủ."
            });
    }
            }
