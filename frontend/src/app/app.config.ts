import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { baseURL } from './compartido/baseurl';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { provideMarkdown } from 'ngx-markdown';
import { AuthInterceptor } from './services/auth-interceptor';
import { TraduccionLoader } from './services/traduccion-loader'
import { IDIOMA_POR_DEFECTO } from './compartido/idiomas-disponibles';
import { config } from '@fortawesome/fontawesome-svg-core';

config.autoAddCss = false;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    {
      provide: 'baseURL',
      useValue: baseURL
    },
    provideClientHydration(withEventReplay()),
    provideHttpClient(withInterceptors([AuthInterceptor]), withFetch()),
    provideCharts(withDefaultRegisterables()),
    provideTranslateService({
      lang: IDIOMA_POR_DEFECTO,
      fallbackLang: IDIOMA_POR_DEFECTO,
      loader: provideTranslateLoader(TraduccionLoader)
    }),
    provideMarkdown()
  ]
};