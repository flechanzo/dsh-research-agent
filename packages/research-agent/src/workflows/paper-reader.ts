import type {
  ResearchPaperDocument,
  ResearchPaperReaderOptions,
  ResearchPaperReadContext,
  ResearchPaperOcrPage,
  ResearchPaperOcr,
} from './research-coordinator.ts'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
/** Shared bounded PDF.js extraction for uploaded and publicly retrieved papers. */
export async function extractPaperBytes(
  bytes: Uint8Array,
  fileName: string,
  options: ResearchPaperReaderOptions = {},
  signal?: AbortSignal,
  context?: ResearchPaperReadContext,
): Promise<ResearchPaperDocument> {
  const resolved = resolvePaperReaderOptions(options)
  const byteLength = bytes.byteLength
  signal?.throwIfAborted()
  if (!isPdfUpload(bytes, fileName)) {
    const text = new TextDecoder().decode(bytes)
    if (text.trim().length === 0) throw new Error(`paper "${fileName}" produced no readable text`)
    return { fileName: fileName, text, byteLength, extractionMethod: 'plain-text' }
  }

  const pdf = await openPdf(bytes, fileName, resolved, signal)
  if (pdf.pages.length === 0) {
    return {
      fileName: fileName,
      text: pdf.text,
      byteLength,
      extractionMethod: 'embedded-text',
      pageCount: pdf.pageCount,
      processedPageCount: pdf.processedPageCount,
      textPages: pdf.embeddedPages,
      missingPages: [],
    }
  }
  if (resolved.ocr === undefined || context?.allowOcr === false) {
    if (context?.allowPartial && pdf.embeddedPages.length > 0)
      return {
        fileName,
        text: pdf.text,
        byteLength,
        extractionMethod: 'embedded-text',
        pageCount: pdf.pageCount,
        processedPageCount: pdf.processedPageCount,
        textPages: pdf.embeddedPages,
        missingPages: pdf.pages.map(p => p.pageNumber),
      }
    throw new Error('PDF_OCR_UNAVAILABLE: this PDF has no usable text layer and no OCR adapter is configured')
  }
  if (context?.parent === undefined) {
    throw new Error('PDF_OCR_PARENT_REQUIRED: OCR requires the parent Agent used for visual delegation')
  }
  context.beforeOcr?.(pdf.pages.length)
  const text = await resolved.ocr.recognize({ fileName: fileName, pages: pdf.pages }, context.parent, signal)
  const mergedText = mergePdfText(pdf.embeddedPages, text)
  if (mergedText.trim().length === 0) throw new Error(`PDF_OCR_EMPTY: OCR produced no readable text for "${fileName}"`)
  return {
    fileName: fileName,
    text: mergedText,
    byteLength,
    extractionMethod: 'ocr',
    textPages: parseTextPages(mergedText).filter(p => p.pageNumber >= 1 && p.pageNumber <= pdf.processedPageCount),
    missingPages: Array.from({ length: pdf.processedPageCount }, (_, i) => i + 1).filter(
      n => !parseTextPages(mergedText).some(p => p.pageNumber === n && p.text.length >= MIN_EMBEDDED_TEXT),
    ),
    pageCount: pdf.pageCount,
    processedPageCount: pdf.processedPageCount,
  }
}
export function parseTextPages(text: string): { pageNumber: number; text: string }[] {
  return [...text.matchAll(/(?:^|\n)Page (\d+)\n([\s\S]*?)(?=\nPage \d+\n|$)/gu)].map(m => ({
    pageNumber: Number(m[1]),
    text: (m[2] ?? '').trim(),
  }))
}
interface PdfExtraction {
  readonly text: string
  readonly embeddedPages: readonly PdfTextPage[]
  readonly pageCount: number
  readonly processedPageCount: number
  readonly pages: readonly ResearchPaperOcrPage[]
}

interface PdfTextPage {
  readonly pageNumber: number
  readonly text: string
}

interface ResolvedPaperReaderOptions {
  readonly maxPdfPages: number
  readonly ocrScale: number
  readonly maxOcrPixels: number
  readonly ocr?: ResearchPaperOcr
}

const DEFAULT_PDF_PAGES = 12
const DEFAULT_OCR_SCALE = 1.5
const DEFAULT_MAX_OCR_PIXELS = 4_000_000
const MIN_EMBEDDED_TEXT = 24

export function resolvePaperReaderOptions(options: ResearchPaperReaderOptions): ResolvedPaperReaderOptions {
  const maxPdfPages = options.maxPdfPages ?? DEFAULT_PDF_PAGES
  const ocrScale = options.ocrScale ?? DEFAULT_OCR_SCALE
  const maxOcrPixels = options.maxOcrPixels ?? DEFAULT_MAX_OCR_PIXELS
  if (!Number.isSafeInteger(maxPdfPages) || maxPdfPages < 1) throw new Error('maxPdfPages must be a positive integer')
  if (!Number.isFinite(ocrScale) || ocrScale <= 0) throw new Error('ocrScale must be a positive number')
  if (!Number.isSafeInteger(maxOcrPixels) || maxOcrPixels < 1)
    throw new Error('maxOcrPixels must be a positive integer')
  return { maxPdfPages, ocrScale, maxOcrPixels, ...(options.ocr === undefined ? {} : { ocr: options.ocr }) }
}

function isPdfUpload(bytes: Uint8Array, fileName: string): boolean {
  return (
    fileName.toLowerCase().endsWith('.pdf') ||
    (bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-')
  )
}

async function openPdf(
  bytes: Uint8Array,
  fileName: string,
  options: ResolvedPaperReaderOptions,
  signal?: AbortSignal,
): Promise<PdfExtraction> {
  signal?.throwIfAborted()
  let document: PDFDocumentProxy | undefined
  let loadingTask: ReturnType<typeof getDocument> | undefined
  try {
    loadingTask = getDocument({
      data: bytes,
      useWorkerFetch: false,
      stopAtErrors: false,
      disableFontFace: true,
      standardFontDataUrl: `${join(dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`,
    })
    document = await loadingTask.promise
    const pageCount = document.numPages
    const pagesToRead = Math.min(pageCount, options.maxPdfPages)
    const embeddedPages: PdfTextPage[] = []
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      signal?.throwIfAborted()
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map(item => ('str' in item ? item.str : ''))
        .filter(text => text.trim().length > 0)
        .join(' ')
      if (pageText.trim().length >= MIN_EMBEDDED_TEXT) embeddedPages.push({ pageNumber, text: pageText.trim() })
    }

    const pages: ResearchPaperOcrPage[] = []
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      if (embeddedPages.some(page => page.pageNumber === pageNumber)) continue
      signal?.throwIfAborted()
      const page = await document.getPage(pageNumber)
      const initialViewport = page.getViewport({ scale: options.ocrScale })
      const requestedPixels = initialViewport.width * initialViewport.height
      const capScale = requestedPixels > options.maxOcrPixels ? Math.sqrt(options.maxOcrPixels / requestedPixels) : 1
      const viewport = capScale === 1 ? initialViewport : page.getViewport({ scale: options.ocrScale * capScale })
      const width = Math.max(1, Math.ceil(viewport.width))
      const height = Math.max(1, Math.ceil(viewport.height))
      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')
      await page.render({ canvas: null, canvasContext: context as never, viewport }).promise
      pages.push({ pageNumber, data: canvas.toBuffer('image/png') })
    }
    return { text: renderPdfTextPages(embeddedPages), embeddedPages, pageCount, processedPageCount: pagesToRead, pages }
  } catch (error) {
    signal?.throwIfAborted()
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`PDF_TEXT_EXTRACTION_FAILED: ${fileName}: ${detail}`, { cause: error })
  } finally {
    if (loadingTask !== undefined) await loadingTask.destroy()
  }
}

function renderPdfTextPages(pages: readonly PdfTextPage[]): string {
  return pages
    .map(page => `Page ${page.pageNumber}\n${page.text}`)
    .join('\n\n')
    .trim()
}

function mergePdfText(embeddedPages: readonly PdfTextPage[], ocrText: string): string {
  const pages = new Map<number, string>(embeddedPages.map(page => [page.pageNumber, page.text]))
  const marker = /(?:^|\n)Page (\d+)\n([\s\S]*?)(?=\nPage \d+\n|$)/g
  let matched = false
  for (const match of ocrText.matchAll(marker)) {
    const pageNumber = Number(match[1])
    const text = match[2]?.trim()
    if (!Number.isSafeInteger(pageNumber) || text === undefined || text.length === 0) continue
    pages.set(pageNumber, text)
    matched = true
  }
  if (!matched && ocrText.trim().length > 0)
    return [renderPdfTextPages(embeddedPages), ocrText.trim()].filter(Boolean).join('\n\n')
  return [...pages.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pageNumber, text]) => `Page ${pageNumber}\n${text}`)
    .join('\n\n')
    .trim()
}
