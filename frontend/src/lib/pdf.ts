import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const fontsDirWindows = path.join("C:", "Windows", "Fonts");
const regularFontCandidates = [
  path.join(fontsDirWindows, "arial.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];
const boldFontCandidates = [
  path.join(fontsDirWindows, "arialbd.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];
const regularFont = regularFontCandidates.find((fontPath) => existsSync(fontPath)) ?? "Helvetica";
const boldFont = boldFontCandidates.find((fontPath) => existsSync(fontPath)) ?? "Helvetica-Bold";
const accentColor = "#312e81";
const accentSoftColor = "#e0e7ff";
const headingColor = "#111827";
const subheadingColor = "#374151";
const bodyColor = "#1f2937";
const borderColor = "#cbd5e1";
const mutedColor = "#6b7280";
const pageMargin = 56;
const footerHeight = 28;
const contentBottom = pageMargin + footerHeight;

function stripInlineMarkdown(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdown(line: string) {
  return stripInlineMarkdown(line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, ""));
}

function isTableSeparator(line: string) {
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line: string) {
  const trimmed = line.trim();
  const content = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return content.split("|").map((cell) => stripInlineMarkdown(cell));
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  const pageBottom = document.page.height - pageMargin - footerHeight;

  if (document.y + height <= pageBottom) {
    return;
  }

  document.addPage();
}

function drawRule(document: PDFKit.PDFDocument, color = accentSoftColor) {
  const startX = document.page.margins.left;
  const endX = document.page.width - document.page.margins.right;
  const y = document.y;

  document
    .save()
    .moveTo(startX, y)
    .lineTo(endX, y)
    .lineWidth(1)
    .strokeColor(color)
    .stroke()
    .restore();

  document.moveDown(0.8);
}

function drawFooter(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);

    const y = document.page.height - pageMargin - footerHeight + 2;
    const startX = document.page.margins.left;
    const endX = document.page.width - document.page.margins.right;

    document
      .save()
      .moveTo(startX, y)
      .lineTo(endX, y)
      .lineWidth(0.75)
      .strokeColor(accentSoftColor)
      .stroke()
      .font(regularFont)
      .fontSize(8)
      .fillColor(mutedColor)
      .text(`Mutual NDA · Page ${index + 1}`, startX, y + 8, {
        align: "right",
        width: endX - startX,
        lineBreak: false,
      })
      .restore();
  }
}

function drawTitleBlock(document: PDFKit.PDFDocument, title: string) {
  ensureSpace(document, 150);

  const left = document.page.margins.left;
  const top = document.y;
  const width = document.page.width - document.page.margins.left - document.page.margins.right;

  document
    .save()
    .roundedRect(left, top, width, 98, 16)
    .fillColor("#f8fafc")
    .fill()
    .roundedRect(left, top, width, 98, 16)
    .lineWidth(1)
    .strokeColor(accentSoftColor)
    .stroke()
    .roundedRect(left + 18, top + 18, 56, 6, 3)
    .fillColor(accentColor)
    .fill()
    .restore();

  document
    .font(boldFont)
    .fontSize(24)
    .fillColor(headingColor)
    .text(title, left + 18, top + 34, { width: width - 36 })
    .moveDown(0.2)
    .font(regularFont)
    .fontSize(10)
    .fillColor(mutedColor)
    .text("Prepared for review and signature", left + 18, document.y, { width: width - 36 });

  document.y = top + 118;
}

function drawSectionHeading(document: PDFKit.PDFDocument, heading: string) {
  ensureSpace(document, 54);
  drawRule(document);

  document
    .font(boldFont)
    .fontSize(15)
    .fillColor(accentColor)
    .text(heading);

  document.moveDown(0.35);
}

function drawSubheading(document: PDFKit.PDFDocument, heading: string) {
  ensureSpace(document, 36);

  document
    .font(boldFont)
    .fontSize(11.5)
    .fillColor(subheadingColor)
    .text(heading, { characterSpacing: 0.2 });

  document.moveDown(0.2);
}

function drawParagraph(document: PDFKit.PDFDocument, text: string, options?: { muted?: boolean; small?: boolean }) {
  ensureSpace(document, 28);

  document
    .font(regularFont)
    .fontSize(options?.small ? 9 : 10.5)
    .fillColor(options?.muted ? mutedColor : bodyColor)
    .text(text, {
      lineGap: options?.small ? 2 : 4,
      paragraphGap: 0,
      align: "left",
    });

  document.moveDown(options?.small ? 0.35 : 0.55);
}

function drawCheckboxLine(document: PDFKit.PDFDocument, checked: boolean, text: string) {
  ensureSpace(document, 24);

  const startX = document.page.margins.left;
  const startY = document.y + 2;
  const boxSize = 11;
  const textX = startX + boxSize + 10;
  const textWidth = document.page.width - document.page.margins.right - textX;

  document
    .save()
    .roundedRect(startX, startY, boxSize, boxSize, 2)
    .lineWidth(1)
    .strokeColor(checked ? accentColor : borderColor)
    .stroke();

  if (checked) {
    document
      .roundedRect(startX + 1.5, startY + 1.5, boxSize - 3, boxSize - 3, 1.5)
      .fillColor(accentColor)
      .fill();
  }

  document.restore();

  document
    .font(regularFont)
    .fontSize(10.5)
    .fillColor(bodyColor)
    .text(text, textX, startY - 2, {
      width: textWidth,
      lineGap: 3,
    });

  document.moveDown(0.35);
}

function drawStandardTerm(document: PDFKit.PDFDocument, line: string) {
  const match = line.match(/^(\d+)\.\s+\*\*(.*?)\*\*\.\s*(.*)$/);

  if (!match) {
    drawParagraph(document, stripMarkdown(line));
    return;
  }

  ensureSpace(document, 40);

  const [, index, title, rest] = match;
  const titleText = `${index}. ${stripInlineMarkdown(title)}`;
  const bodyText = stripInlineMarkdown(rest);

  document
    .font(boldFont)
    .fontSize(11)
    .fillColor(headingColor)
    .text(titleText, { continued: Boolean(bodyText) });

  if (bodyText) {
    document
      .font(regularFont)
      .fontSize(10.5)
      .fillColor(bodyColor)
      .text(` ${bodyText}`, { lineGap: 4 });
  } else {
    document.text("");
  }

  document.moveDown(0.55);
}

function drawTable(document: PDFKit.PDFDocument, rows: string[][]) {
  if (!rows.length) {
    return;
  }

  const usableWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const columns = Math.max(...rows.map((row) => row.length));
  const firstColumnWidth = Math.min(150, usableWidth * 0.33);
  const remainingWidth = usableWidth - firstColumnWidth;
  const otherColumnWidth = columns > 1 ? remainingWidth / (columns - 1) : remainingWidth;
  const columnWidths = Array.from({ length: columns }, (_, index) =>
    index === 0 ? firstColumnWidth : otherColumnWidth,
  );

  const normalizeRow = (row: string[]) =>
    Array.from({ length: columns }, (_, index) => stripInlineMarkdown(row[index] ?? ""));

  const normalizedRows = rows.map(normalizeRow);

  for (const [rowIndex, row] of normalizedRows.entries()) {
    const isHeader = rowIndex === 0;
    const x = document.page.margins.left;
    const textOptions = { lineGap: 3 };
    const cellHeights = row.map((cell, columnIndex) => {
      document.font(columnIndex === 0 ? boldFont : regularFont).fontSize(isHeader ? 10 : 9.5);
      return Math.max(22, document.heightOfString(cell || " ", { width: columnWidths[columnIndex] - 16, ...textOptions }) + 12);
    });
    const rowHeight = Math.max(...cellHeights);

    ensureSpace(document, rowHeight + 6);

    let cursorX = x;
    const y = document.y;

    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const width = columnWidths[columnIndex];
      const cell = row[columnIndex] ?? "";

      document
        .save()
        .roundedRect(cursorX, y, width, rowHeight, 8)
        .fillColor(isHeader ? "#eef2ff" : columnIndex === 0 ? "#f8fafc" : "#ffffff")
        .fill()
        .roundedRect(cursorX, y, width, rowHeight, 8)
        .lineWidth(0.8)
        .strokeColor(borderColor)
        .stroke()
        .restore();

      document
        .font(isHeader || columnIndex === 0 ? boldFont : regularFont)
        .fontSize(isHeader ? 10 : 9.5)
        .fillColor(columnIndex === 0 ? subheadingColor : bodyColor)
        .text(cell || (isHeader ? "" : "—"), cursorX + 8, y + 6, {
          width: width - 16,
          ...textOptions,
        });

      cursorX += width + 6;
    }

    document.y = y + rowHeight + 6;
  }

  document.moveDown(0.4);
}

export function createMutualNdaPdf(markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      margin: pageMargin,
      size: "LETTER",
      font: regularFont,
      bufferPages: true,
      info: {
        Title: "Mutual NDA",
        Author: "Prelegal",
      },
    });
    const chunks: Buffer[] = [];
    const lines = markdown.split(/\r?\n/);

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    let previousLineWasBlank = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        if (!previousLineWasBlank && document.y + 10 <= document.page.height - contentBottom) {
          document.moveDown(0.35);
        }

        previousLineWasBlank = true;
        continue;
      }

      previousLineWasBlank = false;

      if (trimmed === "---") {
        ensureSpace(document, 30);
        drawRule(document, borderColor);
        continue;
      }

      if (line.startsWith("# ")) {
        drawTitleBlock(document, stripMarkdown(line));
        continue;
      }

      if (line.startsWith("## ")) {
        drawSectionHeading(document, stripMarkdown(line));
        continue;
      }

      if (line.startsWith("### ")) {
        drawSubheading(document, stripMarkdown(line));
        continue;
      }

      const checkboxMatch = line.match(/^\s*-\s*\[(x| )\]\s+(.*)$/i);

      if (checkboxMatch) {
        drawCheckboxLine(document, checkboxMatch[1].toLowerCase() === "x", stripInlineMarkdown(checkboxMatch[2]));
        continue;
      }

      if (trimmed.startsWith("|")) {
        const tableRows: string[][] = [];

        while (index < lines.length) {
          const tableLine = lines[index]?.trim() ?? "";

          if (!tableLine.startsWith("|")) {
            index -= 1;
            break;
          }

          if (!isTableSeparator(tableLine)) {
            tableRows.push(parseTableRow(tableLine));
          }

          index += 1;
        }

        drawTable(document, tableRows);
        continue;
      }

      if (/^\d+\.\s+\*\*/.test(trimmed)) {
        drawStandardTerm(document, trimmed);
        continue;
      }

      drawParagraph(document, stripMarkdown(line), {
        small: /free to use under/i.test(trimmed),
        muted: /^Common Paper Mutual Non-Disclosure Agreement/i.test(trimmed) || /^This Mutual Non-Disclosure Agreement/i.test(trimmed),
      });
    }

    drawFooter(document);
    document.end();
  });
}
