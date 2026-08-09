import { v2 as cloudinary } from "cloudinary";
import { requireEnv } from "@/lib/env";

// Dikonfigurasi per-pemanggilan (bukan sekali di module scope saat boot) —
// Cloudinary opsional (beda dari DATABASE_URL/JWT_SECRET yang fail-fast di
// instrumentation.ts), jadi env var kosong baru jadi error saat benar-benar
// dipakai (upload), bukan bikin seluruh app gagal start.
function configureCloudinary() {
  cloudinary.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  });
}

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadImageBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          reject(error instanceof Error ? error : new Error("Upload ke Cloudinary gagal"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}
