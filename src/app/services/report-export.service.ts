import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportStatItem {
  label: string;
  value: string | number;
}

export interface ReportFilterItem {
  label: string;
  value: string | number;
}

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
  fileName: string;
  filters?: ReportFilterItem[];
  stats?: ReportStatItem[];
  headers: string[];
  rows: (string | number)[][];
  orientation?: 'portrait' | 'landscape';
  logoBase64?: string;
}

export interface ExcelExportOptions {
  fileName: string;
  sheetName?: string;
  data: Record<string, any>[];
  filters?: ReportFilterItem[];
  stats?: ReportStatItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {

  exportToExcel(options: ExcelExportOptions): void {
    const workbook = XLSX.utils.book_new();

    const mainSheetName = options.sheetName || 'Rapport';
    const dataWorksheet = XLSX.utils.json_to_sheet(options.data);
    XLSX.utils.book_append_sheet(workbook, dataWorksheet, mainSheetName);

    const syntheseRows: Record<string, any>[] = [];

    if (options.filters?.length) {
      syntheseRows.push({ Section: 'FILTRES', Libellé: '', Valeur: '' });
      options.filters.forEach(filter => {
        syntheseRows.push({
          Section: '',
          Libellé: filter.label,
          Valeur: filter.value
        });
      });
      syntheseRows.push({});
    }

    if (options.stats?.length) {
      syntheseRows.push({ Section: 'SYNTHÈSE', Libellé: '', Valeur: '' });
      options.stats.forEach(stat => {
        syntheseRows.push({
          Section: '',
          Libellé: stat.label,
          Valeur: stat.value
        });
      });
    }

    if (syntheseRows.length > 0) {
      const syntheseWorksheet = XLSX.utils.json_to_sheet(syntheseRows);
      XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, 'Synthèse');
    }

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const blob = new Blob(
      [excelBuffer],
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      }
    );

    saveAs(blob, `${options.fileName}.xlsx`);
  }

exportToPdf(options: PdfTableOptions): void {
  const doc = new jsPDF({
    orientation: options.orientation || 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 15;

  if (options.logoBase64) {
    try {
      doc.addImage(options.logoBase64, 'JPEG', 14, 10, 20, 20);
    } catch (error) {
      console.warn('Impossible de charger le logo dans le PDF', error);
    }
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, 40, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (options.subtitle) {
    doc.text(options.subtitle, 40, 24);
  }

  doc.text(`Date d'export : ${new Date().toLocaleString('fr-FR')}`, 14, 35);
  cursorY = 42;

  if (options.filters?.length) {
    doc.setFont('helvetica', 'bold');
    doc.text('Filtres appliqués', 14, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    options.filters.forEach(filter => {
      doc.text(`- ${filter.label} : ${String(filter.value)}`, 16, cursorY);
      cursorY += 5;
    });

    cursorY += 3;
  }

  if (options.stats?.length) {
    doc.setFont('helvetica', 'bold');
    doc.text('Synthèse', 14, cursorY);
    cursorY += 4;

    const statRows = options.stats.map(stat => [stat.label, String(stat.value)]);

    autoTable(doc, {
      startY: cursorY,
      head: [['Indicateur', 'Valeur']],
      body: statRows,
      theme: 'grid',
      styles: {
        fontSize: 9
      },
      headStyles: {
        fillColor: [41, 128, 185]
      },
      margin: { left: 14, right: 14 }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  autoTable(doc, {
    startY: cursorY,
    head: [options.headers],
    body: options.rows,
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [52, 73, 94]
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(9);
      doc.text(
        `Page ${currentPage} / ${pageCount}`,
        pageWidth - 30,
        doc.internal.pageSize.getHeight() - 8
      );
    }
  });

  doc.save(`${options.fileName}.pdf`);
}

  getDateForFileName(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
  }

  formatDate(value?: string | Date): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR');
  }

  formatDateTime(value?: string | Date): string {
    if (!value) return '';
    return new Date(value).toLocaleString('fr-FR');
  }
}