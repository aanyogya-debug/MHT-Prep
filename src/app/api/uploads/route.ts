import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { uploadImageBuffer } from "@/lib/cloudinary";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_FOLDERS = ["questions", "lessons"] as const;

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diunggah (field 'file')" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Format harus PNG, JPEG, atau WebP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 8MB" }, { status: 400 });
  }

  const folderParam = formData?.get("folder");
  const folder = ALLOWED_FOLDERS.includes(folderParam as (typeof ALLOWED_FOLDERS)[number])
    ? (folderParam as (typeof ALLOWED_FOLDERS)[number])
    : "questions";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImageBuffer(buffer, `mht-prep/${folder}`);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const isConfigError = err instanceof Error && err.message.includes("wajib di-set");
    if (!isConfigError) {
      console.error("POST /api/uploads failed:", err);
    }
    return NextResponse.json(
      { error: isConfigError ? "Cloudinary belum dikonfigurasi" : "Gagal mengunggah gambar" },
      { status: isConfigError ? 500 : 502 },
    );
  }
}
