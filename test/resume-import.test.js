import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { docxXmlToText, importResumeFile, lightFormatResumeText, pdfItemsToText } from "../src/resume-import.js";

test("light formatting recognizes resume sections and bullets", () => {
  assert.equal(
    lightFormatResumeText("Jane Doe\nEXPERIENCE\n• Built accessible tools\nEducation:\nState University"),
    "Jane Doe\n## Experience\n- Built accessible tools\n## Education\nState University"
  );
});

test("PDF items are ordered into readable lines", () => {
  const items = [
    { str: "Doe", transform: [1, 0, 0, 1, 45, 100], height: 10 },
    { str: "Jane", transform: [1, 0, 0, 1, 10, 100], height: 10 },
    { str: "Experience", transform: [1, 0, 0, 1, 10, 75], height: 10 }
  ];
  assert.equal(pdfItemsToText(items), "Jane Doe\n\nExperience");
});

test("Markdown imports preserve existing Markdown", async () => {
  const file = { name: "resume.md", size: 30, text: async () => "# Jane Doe\n\n- Developer\n" };
  assert.equal(await importResumeFile(file), "# Jane Doe\n\n- Developer");
});

test("DOCX XML preserves headings, lists, and escaped text", () => {
  const xml = `<w:document><w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Skills &amp; Tools</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>JavaScript</w:t></w:r></w:p>
  </w:body></w:document>`;
  assert.equal(docxXmlToText(xml), "## Skills & Tools\n- JavaScript");
});

test("DOCX imports read the document XML from a compressed ZIP", async () => {
  const xml = `<w:document><w:body>
    <w:p><w:r><w:t>Jane Doe</w:t></w:r></w:p>
    <w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>
  </w:body></w:document>`;
  const zip = makeZipEntry("word/document.xml", xml);
  const file = {
    name: "resume.docx",
    size: zip.byteLength,
    arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength)
  };
  assert.equal(await importResumeFile(file), "Jane Doe\n## Experience");
});

test("unsupported formats get a useful error", async () => {
  const file = { name: "resume.rtf", size: 30 };
  await assert.rejects(() => importResumeFile(file), /PDF, DOCX, Markdown, or plain-text/);
});

function makeZipEntry(name, contents) {
  const nameBytes = Buffer.from(name);
  const contentBytes = Buffer.from(contents);
  const compressed = deflateRawSync(contentBytes);
  const local = Buffer.alloc(30 + nameBytes.length + compressed.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(contentBytes.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30);
  compressed.copy(local, 30 + nameBytes.length);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(contentBytes.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  nameBytes.copy(central, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}
