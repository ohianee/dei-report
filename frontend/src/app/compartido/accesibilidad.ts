export interface PreferenciasAccesibilidad {
  fuenteDislexia: boolean;
  negrita: boolean;
  escalaFuente: number;
  paleta: PaletaDaltonismo;
  tema: TemaAccesibilidad;
  lecturaAutomatica: boolean;
}
export type PaletaDaltonismo = 'normal' | 'protan-deutan' | 'tritan' | 'alto-contraste';
export type TemaAccesibilidad = 'claro' | 'oscuro' | 'sistema';