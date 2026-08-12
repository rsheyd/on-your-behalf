const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PROFILE_CHARS = 200_000;
const MAX_DOCX_XML_BYTES = 5 * 1024 * 1024;
const SECTION_NAMES = new Set([
  "summary", "profile", "objective", "experience", "work experience",
  "professional experience", "employment", "education", "skills",
  "technical skills", "certifications", "licenses", "projects", "awards",
  "publications", "volunteer experience", "volunteering", "languages"
]);

export async function importResumeFile(file, dependencies = {}) {
  if (!file) throw new Error("Choose a resume file first.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Choose a resume smaller than 10 MB.");

  const extension = file.name.toLowerCase().split(".").pop();
  let markdown;
  if (extension === "md" || extension === "markdown") markdown = cleanMarkdown(await file.text());
  else if (extension === "txt") markdown = lightFormatResumeText(await file.text());
  else if (extension === "docx") markdown = await importDocx(file);
  else if (extension === "pdf") markdown = await importPdf(file, dependencies.loadPdfJs);
  else throw new Error("Use a PDF, DOCX, Markdown, or plain-text file.");

  if (!markdown) throw new Error("No readable text was found in this resume.");
  if (markdown.length > MAX_PROFILE_CHARS) {
    throw new Error("This resume contains too much text. Shorten it to under 200,000 characters.");
  }
  return markdown;
}

async function importDocx(file) {
  const documentXml = await readZipEntry(await file.arrayBuffer(), "word/document.xml");
  const markdown = lightFormatResumeText(docxXmlToText(new TextDecoder().decode(documentXml)));
  if (!markdown) throw new Error("No readable text was found in this DOCX file.");
  return markdown;
}

async function readZipEntry(arrayBuffer, wantedName) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("This DOCX file is invalid or damaged.");

  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (name === wantedName) {
      if (uncompressedSize > MAX_DOCX_XML_BYTES) throw new Error("This DOCX file is too large to import safely.");
      if (view.getUint32(localOffset, true) !== 0x04034b50) break;
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
      throw new Error("This DOCX file uses an unsupported compression method.");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("This DOCX file does not contain a readable document.");
}

export function docxXmlToText(xml) {
  const paragraphs = [];
  for (const match of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const body = match[1];
    const style = body.match(/<w:pStyle[^>]*w:val="([^"]+)"/i)?.[1] || "";
    const isList = /<w:numPr[\s>]/.test(body);
    const text = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map(item => decodeXml(item[1]))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (/^heading\s*[1-6]$/i.test(style)) paragraphs.push(`## ${text}`);
    else paragraphs.push(isList ? `- ${text}` : text);
  }
  return paragraphs.join("\n");
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

async function importPdf(file, suppliedLoader) {
  const pdfjs = suppliedLoader ? await suppliedLoader() : await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false
  });
  const document = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pdfItemsToText(content.items));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  const text = pages.filter(Boolean).join("\n\n");
  if (text.replace(/\s/g, "").length < 20) {
    throw new Error("No readable text was found. Scanned PDFs are not currently supported.");
  }
  return lightFormatResumeText(text);
}

async function loadPdfJs() {
  const pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "./vendor/pdfjs/pdf.worker.min.mjs",
    import.meta.url
  ).href;
  return pdfjs;
}

export function pdfItemsToText(items) {
  const positioned = items
    .filter(item => typeof item.str === "string" && item.str.trim())
    .map((item, index) => ({
      text: item.str.trim(),
      x: Number(item.transform?.[4]) || 0,
      y: Number(item.transform?.[5]) || 0,
      height: Math.abs(Number(item.height)) || 10,
      index
    }));
  const lines = [];

  for (const item of positioned) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2);
    if (!line) {
      line = { y: item.y, height: item.height, items: [] };
      lines.push(line);
    }
    line.items.push(item);
    line.height = Math.max(line.height, item.height);
  }

  lines.sort((a, b) => b.y - a.y);
  const output = [];
  lines.forEach((line, index) => {
    line.items.sort((a, b) => a.x - b.x || a.index - b.index);
    output.push(line.items.map(item => item.text).join(" ").replace(/\s+/g, " "));
    const next = lines[index + 1];
    if (next && line.y - next.y > Math.max(line.height, next.height) * 1.7) output.push("");
  });
  return output.join("\n");
}

export function lightFormatResumeText(text) {
  const lines = normalizeLines(text);
  const formatted = [];

  lines.forEach((line, index) => {
    if (!line) {
      if (formatted.at(-1) !== "") formatted.push("");
      return;
    }

    const normalized = line.replace(/:$/, "").trim().toLowerCase();
    const isKnownSection = SECTION_NAMES.has(normalized);
    const isShortAllCaps = line.length <= 45 && /[A-Z]/.test(line) && line === line.toUpperCase();
    if (isKnownSection || (index > 0 && isShortAllCaps)) {
      formatted.push(`## ${titleCase(line.replace(/:$/, ""))}`);
      return;
    }

    const bullet = line.match(/^[\u2022\u2023\u25E6\u2043\u2219*-]\s*(.+)$/);
    formatted.push(bullet ? `- ${bullet[1].trim()}` : line);
  });

  return cleanMarkdown(formatted.join("\n"));
}

function normalizeLines(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/[\t ]+/g, " ").trim());
}

function cleanMarkdown(text) {
  return normalizeLines(text).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)\p{L}/gu, match => match.toUpperCase());
}
