import { put, get } from "@vercel/blob";

const MAX_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif"
];

function json(data, status = 200){

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers:{
                "Content-Type":"application/json; charset=utf-8"
            }
        }
    );

}

function contentTypeFromName(filename){

    const ext =
        filename
            .split(".")
            .pop()
            .toLowerCase();

    const types = {
        png:"image/png",
        jpg:"image/jpeg",
        jpeg:"image/jpeg",
        webp:"image/webp",
        gif:"image/gif",
        avif:"image/avif"
    };

    return types[ext] || "application/octet-stream";

}


/* =========================
   POST - UPLOAD
========================= */

export async function POST(request){

    try{

        const form =
            await request.formData();

        const file =
            form.get("file");


        if(!file || typeof file.arrayBuffer !== "function"){

            return json(
                {
                    success:false,
                    error:"Không tìm thấy hình ảnh."
                },
                400
            );

        }


        if(!ALLOWED_TYPES.includes(file.type)){

            return json(
                {
                    success:false,
                    error:"Định dạng hình ảnh không được hỗ trợ."
                },
                400
            );

        }


        if(file.size > MAX_SIZE){

            return json(
                {
                    success:false,
                    error:"Hình ảnh vượt quá 4 MB."
                },
                400
            );

        }


        /*
           Lấy tên file từ FormData.
           index.html đã tạo tên ngắn 8 ký tự.
        */

        let filename =
            file.name
                .replace(/[^a-zA-Z0-9._-]/g,"");


        if(!filename){

            filename =
                "image-" +
                Date.now() +
                ".png";

        }


        /*
           UPLOAD VERCEL BLOB
        */

        const blob =
            await put(
                filename,
                file,
                {
                    access:"public",
                    addRandomSuffix:false,
                    contentType:file.type,
                    cacheControlMaxAge:31536000
                }
            );


        /*
           CHỈ TRẢ CUSTOM URL.
           Không trả raw blobUrl.
        */

        const customURL =
            new URL(
                `/images/${encodeURIComponent(filename)}`,
                request.url
            ).toString();


        return json({

            success:true,

            filename,

            url:customURL

        });

    }catch(error){

        console.error(
            "UPLOAD ERROR:",
            error
        );

        return json(
            {
                success:false,
                error:
                    error?.message ||
                    "Lỗi máy chủ khi upload hình ảnh."
            },
            500
        );

    }

}


/* =========================
   GET - /images/filename
========================= */

export async function GET(request){

    try{

        const url =
            new URL(request.url);

        const filename =
            url.searchParams.get("filename");


        if(!filename){

            return new Response(
                "Không tìm thấy tên hình ảnh.",
                {
                    status:400
                }
            );

        }


        const result =
            await get(
                filename,
                {
                    access:"public"
                }
            );


        if(
            !result ||
            result.statusCode !== 200 ||
            !result.stream
        ){

            return new Response(
                "Không tìm thấy hình ảnh.",
                {
                    status:404
                }
            );

        }


        const headers =
            new Headers();

        headers.set(
            "Content-Type",
            result.blob?.contentType ||
            contentTypeFromName(filename)
        );

        headers.set(
            "Content-Disposition",
            "inline"
        );

        headers.set(
            "Cache-Control",
            "public, max-age=31536000, immutable"
        );


        return new Response(
            result.stream,
            {
                status:200,
                headers
            }
        );

    }catch(error){

        console.error(
            "GET IMAGE ERROR:",
            error
        );

        return new Response(
            "Không thể tải hình ảnh.",
            {
                status:500
            }
        );

    }

}
