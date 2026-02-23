import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Generates a PDF from the current invoice/receipt content in the DOM.
 * Returns the jsPDF instance so callers can either save() or get the base64.
 */
export async function generateInvoicePdf(
  contentSelector: string,
): Promise<jsPDF | null> {
  const contentElement = document.querySelector(contentSelector) as HTMLElement | null;
  if (!contentElement) return null;

  // Create a clone so we can force desktop layout for the PDF
  const clone = contentElement.cloneNode(true) as HTMLElement;
  clone.style.width = '794px'; // A4 width at 96dpi
  clone.style.padding = '32px';
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.background = '#fff';

  // Force desktop visibility: show desktop table, hide mobile cards
  clone.querySelectorAll('.sm\\:block').forEach((el) => {
    (el as HTMLElement).style.display = 'block';
  });
  clone.querySelectorAll('.sm\\:hidden').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // Force desktop grid/flex layouts
  clone.querySelectorAll('.sm\\:flex-row').forEach((el) => {
    (el as HTMLElement).style.flexDirection = 'row';
  });
  clone.querySelectorAll('.sm\\:grid-cols-2').forEach((el) => {
    (el as HTMLElement).style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  });
  clone.querySelectorAll('.sm\\:text-right').forEach((el) => {
    (el as HTMLElement).style.textAlign = 'right';
  });
  clone.querySelectorAll('.sm\\:justify-between').forEach((el) => {
    (el as HTMLElement).style.justifyContent = 'space-between';
  });
  clone.querySelectorAll('.sm\\:justify-end').forEach((el) => {
    (el as HTMLElement).style.justifyContent = 'flex-end';
  });

  document.body.appendChild(clone);

  // Wait for images / fonts to settle
  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(clone, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  document.body.removeChild(clone);

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 dimensions in mm
  const pdfWidth = 210;
  const pdfHeight = 297;
  const contentWidth = pdfWidth - 20; // 10mm margin each side
  const ratio = contentWidth / imgWidth;
  const scaledHeight = imgHeight * ratio;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  if (scaledHeight <= pdfHeight - 20) {
    pdf.addImage(imgData, 'PNG', 10, 10, contentWidth, scaledHeight);
  } else {
    const pageContentHeight = pdfHeight - 20;
    let yOffset = 0;

    while (yOffset < scaledHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, 10 - yOffset, contentWidth, scaledHeight);
      yOffset += pageContentHeight;
    }
  }

  return pdf;
}

/**
 * Returns the PDF as a base64 string (without the data URI prefix).
 */
export async function generateInvoicePdfBase64(
  contentSelector: string,
): Promise<string | null> {
  const pdf = await generateInvoicePdf(contentSelector);
  if (!pdf) return null;
  // output('datauristring') returns "data:application/pdf;filename=...;base64,XXXX"
  // We just want the raw base64 portion
  const dataUri = pdf.output('datauristring');
  const base64 = dataUri.split(',')[1];
  return base64;
}
