"use client";

import { FileThumbnail, type FileThumbnailProps } from './file-thumbnail';

// Kept outside the base preview so installing or bundling image previews does
// not require PDF.js. The enhancement loads only when a PDF is rendered.
const renderPdf: NonNullable<FileThumbnailProps['renderPdf']> = async (...args) =>
  (await import('@/lib/pdf-thumbnail')).renderPdfFirstPage(...args);

export function PdfFileThumbnail(props: Omit<FileThumbnailProps, 'renderPdf'>) {
  return <FileThumbnail {...props} renderPdf={renderPdf} />;
}

export { setPdfWorkerSrc } from '@/lib/pdf-thumbnail';
