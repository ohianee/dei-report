import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { ChatbotDei } from './chatbot-dei';
import { Analisis } from '../../services/analisis';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('ChatbotDei', () => {
  let analisisFake: { 
    enviarMensajeChatStream: ReturnType<typeof vi.fn>;
    comprobarEstadoChat: ReturnType<typeof vi.fn>; 
  };

  function crear() {
    TestBed.configureTestingModule({
      imports: [ChatbotDei],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Analisis, useValue: analisisFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    });
    const fixture = TestBed.createComponent(ChatbotDei);
    const component = fixture.componentInstance;
    component.jobId = 'job-1';
    return component;
  }

  beforeEach(() => {
    analisisFake = { 
      enviarMensajeChatStream: vi.fn(),
      comprobarEstadoChat: vi.fn().mockReturnValue(of(true)) 
    };
  });

  it('should create', () => {
    expect(crear()).toBeTruthy();
  });

  it('empieza con el mensaje de bienvenida del asistente', () => {
    const component = crear();
    expect(component.mensajes().length).toBe(1);
    expect(component.mensajes()[0].role).toBe('assistant');
  });

  it('no envía nada si el mensaje está vacío', () => {
    const component = crear();
    component.mensajeInput.set('   ');

    component.enviarMensaje();

    expect(analisisFake.enviarMensajeChatStream).not.toHaveBeenCalled();
  });

  it('no envía un segundo mensaje mientras se está cargando la respuesta anterior', () => {
    const component = crear();
    analisisFake.enviarMensajeChatStream.mockReturnValue(of('ok'));
    component.mensajeInput.set('hola');
    component.cargando.set(true);

    component.enviarMensaje();

    expect(analisisFake.enviarMensajeChatStream).not.toHaveBeenCalled();
  });

  it('en éxito, añade el mensaje del usuario y va montando la respuesta fragmento a fragmento', () => {
    const component = crear();
    analisisFake.enviarMensajeChatStream.mockReturnValue(of('te ', 'lo ', 'explico'));
    component.mensajeInput.set('¿cuál es mi score?');

    component.enviarMensaje();

    const mensajes = component.mensajes();
    expect(mensajes[mensajes.length - 2]).toEqual({ role: 'user', content: '¿cuál es mi score?' });
    expect(mensajes[mensajes.length - 1]).toEqual({ role: 'assistant', content: 'te lo explico' });
    expect(component.cargando()).toBe(false);
    expect(component.mostrandoTyping()).toBe(false);
    expect(component.mensajeInput()).toBe('');
  });

  it('el historial enviado al backend no incluye el mensaje de bienvenida', () => {
    const component = crear();
    analisisFake.enviarMensajeChatStream.mockReturnValue(of('ok'));
    component.mensajeInput.set('hola de nuevo');

    component.enviarMensaje();

    const historialEnviado = analisisFake.enviarMensajeChatStream.mock.calls[0][1].historial;
    expect(historialEnviado.some((m: any) => m.content === component.mensajes()[0].content)).toBe(false);
  });

  it('en error, añade un mensaje de error del asistente', () => {
    const component = crear();
    analisisFake.enviarMensajeChatStream.mockReturnValue(throwError(() => new Error('fallo')));
    component.mensajeInput.set('hola');

    component.enviarMensaje();

    const mensajes = component.mensajes();
    expect(mensajes[mensajes.length - 1].role).toBe('assistant');
    expect(component.cargando()).toBe(false);
    expect(component.mostrandoTyping()).toBe(false);
  });

  it('toggleChat alterna el panel abierto/cerrado', () => {
    const component = crear();
    expect(component.abierto()).toBe(false);
    component.toggleChat();
    expect(component.abierto()).toBe(true);
  });
});