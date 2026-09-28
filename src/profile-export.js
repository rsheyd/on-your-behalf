import { validateSupportingDocuments } from "./supporting-documents.js";

const encoder = new TextEncoder();
const u16 = value => [value & 255, (value >>> 8) & 255];
const u32 = value => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

export function createProfileExport(profile, supportingDocuments) {
  const documents = validateSupportingDocuments(supportingDocuments);
  const entries = [
    ["manifest.json", JSON.stringify({ format: "oyb-profile", version: 1, documents: documents.map((document, index) => ({ id: document.id, name: document.name, type: document.type, importedAt: document.importedAt, enabled: document.enabled, path: `supporting/${String(index + 1).padStart(4, "0")}.txt` })) })],
    ["profile.md", String(profile || "")],
    ...documents.map((document, index) => [`supporting/${String(index + 1).padStart(4, "0")}.txt`, document.text])
  ];
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, contents] of entries) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(contents);
    const crc = crc32(data);
    const localHeader = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...nameBytes]);
    const centralHeader = Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes]);
    local.push(localHeader, data);
    central.push(centralHeader);
    offset += localHeader.length + data.length;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  return new Blob([...local, ...central, end], { type: "application/zip" });
}
