import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Product from "../models/Product"; // adjust path if needed

const MONGO = process.env.MONGODB_URI!;
const DRY_RUN = process.env.DRY_RUN !== "false"; // default: true

function fixText(s?: string): string | undefined {
  if (!s) return s;
  let t = s;

  // Rule 1: specific known bad pattern
  t = t.replace(/ENC\uFFFD/gi, "ENC™");

  // Rule 2: remove any stray "�"
  t = t.replace(/\uFFFD/g, "");

  return t;
}

async function run() {
  await mongoose.connect(MONGO);

  const badProducts = await Product.find({
    $or: [
      { name: /\uFFFD/ },
      { description: /\uFFFD/ },
      { tags: /\uFFFD/ }
    ]
  }).lean();

  console.log(`🔍 Found ${badProducts.length} products with �`);

  for (const p of badProducts) {
    const fixedName = fixText(p.name);
    const fixedDesc = fixText(p.description);

    if (fixedName === p.name && fixedDesc === p.description) continue;

    console.log(`🛠 Fixing ${p._id}`);
    console.log(`   Name: "${p.name}" → "${fixedName}"`);
    if (p.description && p.description.includes("�")) {
      console.log(`   Desc: "${p.description.slice(0, 60)}..." → "${fixedDesc?.slice(0, 60)}..."`);
    }

    if (!DRY_RUN) {
      await Product.updateOne(
        { _id: p._id },
        { $set: { name: fixedName, description: fixedDesc } }
      );
    }
  }

  console.log(DRY_RUN ? "✅ Dry run complete (no DB changes)." : "✅ Changes applied.");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("❌ Script error:", e);
  process.exit(1);
});
