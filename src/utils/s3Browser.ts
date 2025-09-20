// src/utils/s3Browser.ts

const RAW_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_BASE = RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE}/api`;
const SIGN_ENDPOINT = `${API_BASE}/uploads/s3/sign`;


// Reuse your existing validator rules (5–10MB, jpg/png/webp)
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const maxSize = 10 * 1024 * 1024;
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Select JPG, PNG or WEBP." };
  }
  if (file.size > maxSize) return { valid: false, error: "File too large (max 10MB)" };
  return { valid: true };
};

export type S3UploadResult = {
  url: string;      // public URL to save in DB
  key: string;      // S3 object key (handy for deletes)
  contentType: string;
};

type PresignResp = { uploadUrl: string; publicUrl: string; key: string };

// Get presigned PUT url from your backend
async function getPresignedUrl(file: File): Promise<PresignResp> {
  const params = new URLSearchParams({
    contentType: file.type || 'application/octet-stream',
    filename: file.name || 'file.bin',
  });

  const res = await fetch(`${SIGN_ENDPOINT}?${params.toString()}`, {
    // only needed if your backend uses cookies/auth; otherwise you can omit
    // credentials: 'include',
  });
  if (!res.ok) throw new Error(`Presign failed: ${res.status}`);
  return res.json();
}

// Real PUT with progress via XHR (fetch has no upload progress)
function putToS3(uploadUrl: string, file: File, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    // Do NOT set ACL headers here; ACL is already embedded in the presign (server side)
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress?.(pct);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading to S3"));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 PUT ${xhr.status}`)));
    xhr.send(file);
  });
}

export async function uploadToS3Browser(
  file: File,
  onProgress?: (p: number) => void
): Promise<S3UploadResult> {
  const v = validateFile(file);
  if (!v.valid) throw new Error(v.error);
  const { uploadUrl, publicUrl, key } = await getPresignedUrl(file);
  await putToS3(uploadUrl, file, onProgress);
  return { url: publicUrl, key, contentType: file.type };
}

export async function uploadMultipleToS3Browser(
  files: File[],
  onProgressEach?: (index: number, p: number) => void,
  concurrency = 3
): Promise<S3UploadResult[]> {
  const out: S3UploadResult[] = new Array(files.length);
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const idx = i++;
      out[idx] = await uploadToS3Browser(files[idx], (p) => onProgressEach?.(idx, p));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return out;
}
