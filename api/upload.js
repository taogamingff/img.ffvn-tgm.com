import { put, get } from "@vercel/blob";

const MAX_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif"
];


function json(data,status=200){

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers:{
                "Content-Type":
                    "application/json; charset=utf-8",
                "Cache-Control":
                    "no-store"
            }
        }
    );

}


function getContentType(filename){

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

    return (
        types[ext] ||
        "application/octet-stream"
    );
}


/* =========================
   POST UPLOAD
========================= */

export async function POST(request){

    try{

        const formData =
            await request.formData();

        const file =
            formData.get("file");


        if(
            !file ||
            typeof file.arrayBuffer !== "function"
        ){

            return json(
                {
                    success:false,
                    error:"Không nhận được file."
                },
                400
            );

        }


        if(
            !ALLOWED_TYPES.includes(
                file.type
            )
        ){

            return json(
                {
                    success:false,
                    error:"Định dạng ảnh không được hỗ trợ."
                },
                400
            );

        }


        if(
            file.size >
            MAX_SIZE
        ){

            return json(
                {
                    success:false,
                    error:"Ảnh vượt quá 4 MB."
                },
                400
            );

        }


        /*
           Tên file ngắn được tạo từ index.html
        */

        let filename =
            String(file.name || "")
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    ""
                );


        if(!filename){

            filename =
                "image-" +
                Date.now() +
                ".png";

        }


        /*
           ĐẢM BẢO KHÔNG GHI ĐÈ
           Nếu tên đã tồn tại thì tạo tên mới.
        */

        const ext =
            filename.includes(".")
                ? filename
                    .split(".")
                    .pop()
                : "png";


        /*
           Upload Blob
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
           filename CHÍNH LÀ GIÁ TRỊ
           MÀ FRONTEND CẦN.
        */

        return json(
            {
                success:true,

                filename:filename,

                url:
                    `/images/` +
                    encodeURIComponent(
                        filename
                    )
            },
            200
        );


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
                    "Upload thất bại."
            },
            500
        );

    }

}


/* =========================
   GET IMAGE
========================= */

export async function GET(request){

    try{

        const url =
            new URL(request.url);

        const filename =
            url.searchParams.get(
                "filename"
            );


        if(!filename){

            return new Response(
                "Thiếu filename.",
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
            getContentType(filename)
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
            "GET ERROR:",
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
