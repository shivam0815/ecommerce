import axios from "axios";
import * as fs from "fs";
import * as path from "path";

// Ensure dotenv loads BEFORE reading process.env
const dotenvPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(dotenvPath)) {
  require("dotenv").config({ path: dotenvPath });
}

function reveal(s?: string) {
  if (!s) return { length: 0, codes: [] };
  const codes = [...s].map((ch) => ch.charCodeAt(0));
  return { length: s.length, codes };
}

(async () => {
  const BASE_URL = (process.env.SHIPROCKET_BASE_URL || "").trim();
  const EMAIL = process.env.SHIPROCKET_EMAIL ?? "";
  const PASSWORD = process.env.SHIPROCKET_PASSWORD ?? "";

  console.log("ENV PRESENCE:", {
    hasBaseUrl: !!BASE_URL,
    hasEmail: !!EMAIL,
    hasPassword: !!PASSWORD,
  });

  // Show hidden characters (spaces/newlines) WITHOUT printing secrets:
  console.log("ENV DIAGNOSTICS (no secrets):", {
    baseUrlChars: reveal(BASE_URL),
    emailChars: reveal(EMAIL.replace(/.(?=.{3}@)/g, "*")), // partially masked
    passwordChars: reveal(PASSWORD.replace(/./g, "*")),
  });

  // Sanity on exact URL + body
  const url = `${BASE_URL}/v1/external/auth/login`;
  console.log("AUTH URL:", url);

  try {
    const { data, status } = await axios.post(
      url,
      { email: EMAIL, password: PASSWORD },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    console.log("SUCCESS", { status, tokenStartsWith: String(data?.token || "").slice(0, 10) });
    process.exit(0);
  } catch (err: any) {
    console.log("FAIL", {
      status: err?.response?.status,
      body: err?.response?.data,
      message: err?.message,
    });
    process.exit(1);
  }
})();
