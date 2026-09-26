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

function getToken() {

    const token =
        process.env.BLOB_READ_WRITE_TOKEN;

    if(!token){

        throw new Error(
            "BLOB_READ_WRITE_TOKEN chưa được cấu hình."
        );
    }

    return token.trim();
}

function validFilename(filename) {

    return /^[A-Za-z0-9]{8}\.(png|jpg|webp|gif|avif)$/i.test(
        filename
    );
}

function contentTypeFromFilename(filename) {

    const ext =
        filename
            .split(".")
            .pop()
            .toLowerCase();

    const map = {
        png: "image/png",
        jpg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        avif: "image/avif"
    };

    return (
        map[ext] ||
        "application/octet-stream"
    );
}

async function readBody(req) {

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

export default async function handler(
    req,
    res
){

    try{

        const filename =
            String(
                req.query?.filename || ""
            )
            .split("/")
            .pop();

        /*
         * =================================
         * GET /images/xxxxxxxx.png
         * =================================
         *
         * Lấy ảnh từ Blob và trả trực tiếp
         * qua domain img-ffvn-tgm-com.
         */

        if(req.method === "GET"){

            if(!validFilename(filename)){

                return res
                    .status(400)
                    .send(
                        "Tên ảnh không hợp lệ."
                    );
            }

            const result =
                await get(
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
                    .send(
                        "Không tìm thấy hình ảnh."
                    );
            }

            const type =
                result.blob?.contentType ||
                contentTypeFromFilename(
                    filename
                );

            /*
             * Response Web Stream theo API
             * Vercel Blob.
             */

            return res
                .status(200)
                .setHeader(
                    "Content-Type",
                    type
                )
                .setHeader(
                    "Content-Disposition",
                    "inline"
                )
                .setHeader(
                    "Cache-Control",
                    "public, max-age=31536000, immutable"
                )
                .end(
                    Buffer.from(
                        await new Response(
                            result.stream
                        ).arrayBuffer()
                    )
                );
        }

        /*
         * =================================
         * POST /api/upload
         * =================================
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
                        "Định dạng ảnh không được hỗ trợ."
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
                        "Không nhận được dữ liệu ảnh."
                });
        }

        /*
         * LƯU ẢNH VÀO VERCEL BLOB
         */

        await put(
            filename,
            buffer,
            {
                token:getToken(),
                access:"public",
                addRandomSuffix:false,
                contentType,
                cacheControlMaxAge:31536000
            }
        );

        /*
         * CHỈ TRẢ LINK WEBSITE.
         *
         * Không trả blobUrl.
         */

        const url =
            "https://img-ffvn-tgm-com.vercel.app/images/" +
            encodeURIComponent(filename);

        return res
            .status(200)
            .json({
                success:true,
                filename,
                url,
                contentType,
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
