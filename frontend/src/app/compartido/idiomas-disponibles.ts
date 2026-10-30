import { es } from '../i18n/es';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import { de } from '../i18n/de';
import { pt } from '../i18n/pt';

export interface IdiomaDisponible {
  codigo: string;
  etiqueta: string;
  bandera: string;
}

export const TRADUCCIONES_POR_IDIOMA: Record<string, object> = {
  es, en, fr, de, pt,
};

export const IDIOMAS_DISPONIBLES: IdiomaDisponible[] = [
  { codigo: 'es', etiqueta: 'Español', bandera: '🇪🇸' },
  { codigo: 'en', etiqueta: 'English', bandera: '🇬🇧' },
  { codigo: 'fr', etiqueta: 'Français', bandera: '🇫🇷' },
  { codigo: 'de', etiqueta: 'Deutsch', bandera: '🇩🇪' },
  { codigo: 'pt', etiqueta: 'Português', bandera: '🇵🇹' },
];

export const IDIOMA_POR_DEFECTO = 'es';