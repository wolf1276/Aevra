// Downloads the compiled eERC ZK circuit artifacts (wasm + Groth16 zkeys)
// into public/circuits/. Source: the official Ava Labs eERC SDK example app
// (github.com/BeratOz01/3dent, linked from docs.avacloud.io), whose artifacts
// are built from github.com/ava-labs/EncryptedERC circom circuits.
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE = "https://raw.githubusercontent.com/BeratOz01/3dent/main/public";
const FILES = [
  "RegistrationCircuit.wasm",
  "RegistrationCircuit.groth16.zkey",
  "TransferCircuit.wasm",
  "TransferCircuit.groth16.zkey",
  "WithdrawCircuit.wasm",
  "WithdrawCircuit.groth16.zkey",
  "MintCircuit.wasm",
  "MintCircuit.groth16.zkey",
];

mkdirSync("public/circuits", { recursive: true });
for (const file of FILES) {
  const dest = `public/circuits/${file}`;
  if (existsSync(dest)) {
    console.log(`skip ${file} (exists)`);
    continue;
  }
  console.log(`fetching ${file}…`);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}
console.log("circuits ready in public/circuits/");
