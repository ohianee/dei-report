import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { Analisis } from './analisis';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class DescargarInformeService {
  private analisisService = inject(Analisis);
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getCssVariable(variable: string, fallback: string): string {
    if (!this.isBrowser) return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return val || fallback;
  }

  private hexToRgb(hex: string): [number, number, number] {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const bigint = parseInt(hex, 16);
    if (isNaN(bigint)) return [0, 0, 0];
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }

  private async cargarFuenteBase64(url: string): Promise<string> {
    if (!this.isBrowser) return '';
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async generarYDescargar(jobId: string): Promise<void> {
    if (!this.isBrowser) return;

    const rgbNavy = this.hexToRgb(this.getCssVariable('--c-navy', '#273469'));
    const rgbPurple = this.hexToRgb(this.getCssVariable('--c-purple-muted', '#8687b4'));
    const rgbGray = this.hexToRgb(this.getCssVariable('--c-gray', '#95979f'));
    const rgbDarkGray = this.hexToRgb(this.getCssVariable('--c-dark-gray', '#30343f'));
    const htmlClasses = document.documentElement.classList;
    const isDyslexic = htmlClasses.contains('dei-fuente-dislexia');
    const isBold = htmlClasses.contains('dei-negrita');
    const scaleStr = this.getCssVariable('--dei-escala-fuente', '100%');
    const fontScale = (parseInt(scaleStr, 10) || 100) / 100;

    let baseFont = 'helvetica';
    const globalFontStyle: 'bold' | 'normal' = isBold ? 'bold' : 'normal';
    const t = (key: string) => this.translate.instant(`PDF_INFORME.${key}`);
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;

    if (isDyslexic) {
      try {
        const fontRegularB64 = await this.cargarFuenteBase64('/fonts/OpenDyslexic-Regular.ttf');
        doc.addFileToVFS('OpenDyslexic-Regular.ttf', fontRegularB64);
        doc.addFont('OpenDyslexic-Regular.ttf', 'OpenDyslexic', 'normal');

        const fontBoldB64 = await this.cargarFuenteBase64('/fonts/OpenDyslexic-Bold.ttf');
        doc.addFileToVFS('OpenDyslexic-Bold.ttf', fontBoldB64);
        doc.addFont('OpenDyslexic-Bold.ttf', 'OpenDyslexic', 'bold');

        baseFont = 'OpenDyslexic';
      } catch (error) {
        console.error("No se pudo cargar la tipografía OpenDyslexic para el PDF.", error);
        baseFont = 'helvetica';
      }
    }

    this.analisisService.getInforme(jobId).subscribe({
      next: (informe) => {
        const applyFont = (size: number, color: [number, number, number], forceBold = false) => {
          doc.setFont(baseFont, forceBold ? 'bold' : globalFontStyle);
          doc.setFontSize(size * fontScale);
          doc.setTextColor(...color);
        };

        const checkY = (currentY: number, spaceNeeded: number) => {
          if (currentY + (spaceNeeded * fontScale) > pageHeight - 20) {
            doc.addPage();
            return 20;
          }
          return currentY;
        };

        const tableBaseStyles: any = { font: baseFont, fontStyle: globalFontStyle, fontSize: 10 * fontScale };
        const tableHeadStyles: any = { font: baseFont, fontStyle: 'bold', fontSize: 10 * fontScale, fillColor: rgbNavy, textColor: 255 };

        applyFont(22, rgbNavy, true);
        doc.text(t('TITULO'), 14, 20);
        applyFont(10, rgbGray);
        doc.text(`${t('ID_REF')} ${jobId}`, 14, 20 + (8 * fontScale));
        doc.text(`${t('FECHA_EXP')} ${new Date().toLocaleString()}`, 14, 20 + (13 * fontScale));
        
        let currentY = 20 + (25 * fontScale);
        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_RESUMEN'), 14, currentY);

        autoTable(doc, {
          startY: currentY + (5 * fontScale),
          head: [[t('COL_METRICA'), t('COL_VALOR')]],
          body: [
            [t('MET_SCORE'), informe.lenguajeInclusivoCodigo.scoreGlobal.toFixed(1) + ' / 100'],
            [t('MET_ENTROPIA'), informe.metricasGlobales.entropia_shannon.toFixed(2)],
            [t('MET_SIMPSON'), informe.metricasGlobales.indice_simpson.toFixed(2)],
            [t('MET_TTR'), (informe.metricasGlobales.ratio_unicos * 100).toFixed(1) + ' %']
          ],
          theme: 'striped',
          styles: tableBaseStyles,
          headStyles: tableHeadStyles,
        });

        let finalY = (doc as any).lastAutoTable.finalY;
        finalY = checkY(finalY, 40);

        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_PSICOMETRIA'), 14, finalY + (15 * fontScale));
        autoTable(doc, {
          startY: finalY + (20 * fontScale),
          head: [[t('COL_BIG_FIVE'), t('COL_APARICIONES'), t('COL_TONO'), t('COL_APARICIONES')]],
          body: (() => {
            const b5Keys = Object.keys(informe.bigFive);
            const toneKeys = Object.keys(informe.tonoCodigo);
            const maxLen = Math.max(b5Keys.length, toneKeys.length);
            const rows = [];
            for (let i = 0; i < maxLen; i++) {
              rows.push([
                b5Keys[i] || '-', informe.bigFive[b5Keys[i]] ?? '-',
                toneKeys[i] || '-', informe.tonoCodigo[toneKeys[i]] ?? '-'
              ]);
            }
            return rows;
          })(),
          theme: 'grid',
          styles: tableBaseStyles,
          headStyles: { ...tableHeadStyles, fillColor: rgbPurple } as any,
        });

        finalY = (doc as any).lastAutoTable.finalY;
        finalY = checkY(finalY, 30);
        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_DIVERSIDAD_AUTOR'), 14, finalY + (15 * fontScale));

        const authorsBody = informe.diversidadAutores.map(a => [
          a.author, a.n_comentarios.toString(), a.n_adjetivos.toString(), 
          a.entropia.toFixed(2), a.simpson.toFixed(2)
        ]);

        autoTable(doc, {
          startY: finalY + (20 * fontScale),
          head: [[t('COL_AUTOR'), t('COL_COMENTARIOS'), t('COL_ADJETIVOS'), t('COL_ENTROPIA'), t('COL_SIMPSON')]],
          body: authorsBody,
          theme: 'striped',
          styles: tableBaseStyles,
          headStyles: tableHeadStyles,
        });

        finalY = (doc as any).lastAutoTable.finalY;
        finalY = checkY(finalY, 30);
        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_INCLUSIVIDAD_REPO'), 14, finalY + (15 * fontScale));

        const reposBody = informe.lenguajeInclusivoCodigo.resumenRepos.map(r => [
          r.repo, r.archivosAnalizados.toString(), r.identificadoresAnalizados.toString(), 
          r.hallazgos.toString(), r.scoreInclusividad.toFixed(1)
        ]);

        autoTable(doc, {
          startY: finalY + (20 * fontScale),
          head: [[t('COL_REPO'), t('COL_ARCHIVOS'), t('COL_IDENTIFICADORES'), t('COL_HALLAZGOS'), t('COL_SCORE')]],
          body: reposBody,
          theme: 'striped',
          styles: tableBaseStyles,
          headStyles: tableHeadStyles,
        });

        finalY = (doc as any).lastAutoTable.finalY;
        finalY = checkY(finalY, 30);
        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_HALLAZGOS_DETALLE'), 14, finalY + (15 * fontScale));

        const hallazgosBody = informe.lenguajeInclusivoCodigo.hallazgos.map(h => [
          h.repo, h.path, h.identificador, h.severidad.toUpperCase(), 
          h.alternativas, String(h.ocurrencias)
        ]);

        if (hallazgosBody.length > 0) {
          autoTable(doc, {
            startY: finalY + (20 * fontScale),
            head: [[t('COL_REPO'), t('COL_ARCHIVO'), t('COL_IDENTIFICADOR'), t('COL_SEVERIDAD'), t('COL_ALTERNATIVA'), t('COL_NUMERO')]],
            body: hallazgosBody,
            theme: 'grid',
            headStyles: { ...tableHeadStyles, fillColor: rgbPurple } as any,
            styles: { ...tableBaseStyles, fontSize: 8 * fontScale, overflow: 'linebreak' } as any,
            columnStyles: {
              0: { cellWidth: 25 },
              1: { cellWidth: 40 },
              2: { cellWidth: 35, fontStyle: 'bold' },
              3: { cellWidth: 20 },
              4: { cellWidth: 'auto' },
              5: { cellWidth: 10, halign: 'center' }
            }
          });
          finalY = (doc as any).lastAutoTable.finalY;
        } else {
          applyFont(11, rgbDarkGray);
          doc.text(t('SIN_HALLAZGOS_CODIGO'), 14, finalY + (25 * fontScale));
          finalY += (35 * fontScale);
        }

        finalY = checkY(finalY, 30);
        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_CLIMA'), 14, finalY + (15 * fontScale));

        const clima = informe.climaComunicacion;
        if (clima) {
          autoTable(doc, {
            startY: finalY + (20 * fontScale),
            head: [[t('COL_METRICA'), t('COL_VALOR')]],
            body: [
              [t('MET_COM_ANALIZADOS'), clima.comentariosAnalizados.toString()],
              [t('MET_COM_POSITIVOS'), clima.porcentajePositivos.toFixed(1) + ' %'],
              [t('MET_COM_NEGATIVOS'), clima.porcentajeNegativos.toFixed(1) + ' %'],
              [t('MET_COM_NEUTROS'), clima.porcentajeNeutros.toFixed(1) + ' %'],
              [t('MET_COM_TOXICOS'), clima.comentariosToxicos.toString()],
              [t('MET_PCT_TOXICOS'), clima.porcentajeToxicos.toFixed(1) + ' %'],
            ],
            theme: 'striped',
            styles: tableBaseStyles,
            headStyles: tableHeadStyles,
          });
          finalY = (doc as any).lastAutoTable.finalY;
        } else {
          applyFont(11, rgbDarkGray);
          doc.text(t('SIN_DATOS_CLIMA'), 14, finalY + (25 * fontScale));
          finalY += (35 * fontScale);
        }

        finalY = checkY(finalY, 30);
        applyFont(14, rgbDarkGray, true);
        doc.text(t('SEC_HALLAZGOS_COMENTARIOS'), 14, finalY + (15 * fontScale));
        
        const comentariosBody = (informe.hallazgosComentarios || []).map(c => [
          c.repo, c.author, c.tipo, c.termino, c.severidad.toUpperCase(), c.contexto
        ]);

        if (comentariosBody.length > 0) {
          autoTable(doc, {
            startY: finalY + (20 * fontScale),
            head: [[t('COL_REPO'), t('COL_AUTOR'), t('COL_TIPO'), t('COL_TERMINO'), t('COL_SEVERIDAD'), t('COL_CONTEXTO')]],
            body: comentariosBody,
            theme: 'grid',
            headStyles: { ...tableHeadStyles, fillColor: rgbPurple } as any,
            styles: { ...tableBaseStyles, fontSize: 8 * fontScale, overflow: 'linebreak' } as any,
            columnStyles: {
              0: { cellWidth: 25 },
              1: { cellWidth: 25 },
              2: { cellWidth: 25 },
              3: { cellWidth: 25, fontStyle: 'bold' },
              4: { cellWidth: 20 },
              5: { cellWidth: 'auto' }
            }
          });
        } else {
          applyFont(11, rgbDarkGray);
          doc.text(t('SIN_HALLAZGOS_COMENTARIOS'), 14, finalY + (25 * fontScale));
        }

        doc.save(`DEI-Report-${jobId.substring(0,8)}.pdf`);
      },
      error: (err) => {
        console.error("Error al descargar el informe:", err);
        alert(this.translate.instant('HISTORICO.ERROR_PDF'));
      }
    });
  }
}