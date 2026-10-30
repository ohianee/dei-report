export interface HistorialItem {
  job_id: string;
  fecha: Date;
  objetivo: string;
  estado: 'pendiente' | 'procesando' | 'completado' | 'error';
}