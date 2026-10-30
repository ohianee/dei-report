import { firstValueFrom } from 'rxjs';
import { TraduccionLoader } from './traduccion-loader';
import { TRADUCCIONES_POR_IDIOMA, IDIOMA_POR_DEFECTO } from '../compartido/idiomas-disponibles'

describe('TraduccionLoader', () => {
  let loader: TraduccionLoader;

  beforeEach(() => {
    loader = new TraduccionLoader();
  });

  it('should be created', () => {
    expect(loader).toBeTruthy();
  });

  it('devuelve las traducciones del idioma pedido', async () => {
    const traducciones = await firstValueFrom(loader.getTranslation('en'));
    expect(traducciones).toBe(TRADUCCIONES_POR_IDIOMA['en']);
  });

  it('cae al idioma por defecto si el idioma pedido no existe', async () => {
    const traducciones = await firstValueFrom(loader.getTranslation('xx'));
    expect(traducciones).toBe(TRADUCCIONES_POR_IDIOMA[IDIOMA_POR_DEFECTO]);
  });
});
