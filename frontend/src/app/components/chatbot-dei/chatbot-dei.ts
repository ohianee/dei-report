import { Component, Input, inject, signal, ViewChild, ElementRef, AfterViewChecked, HostListener, PLATFORM_ID, OnDestroy, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MarkdownModule } from 'ngx-markdown';
import { Analisis } from '../../services/analisis';
import { MensajeChat } from '../../compartido/chat';

@Component({
  selector: 'app-chatbot-dei',
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, TranslatePipe, MarkdownModule],
  templateUrl: './chatbot-dei.html',
  styleUrl: './chatbot-dei.scss'
})
export class ChatbotDei implements OnInit, AfterViewChecked, OnDestroy {
  @Input() jobId!: string;
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  private analisisService = inject(Analisis);
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);

  abierto = signal<boolean>(false);
  cargando = signal<boolean>(false);
  mostrandoTyping = signal<boolean>(false);
  mensajeInput = signal<string>('');
  
  mensajes = signal<MensajeChat[]>([
    { role: 'assistant', content: this.translate.instant('CHAT.BIENVENIDA') }
  ]);

  isDesktop = signal<boolean>(false);
  anchoChat = signal<number>(400);
  arrastrando = signal<boolean>(false);
  enLinea = signal<boolean>(false);

  private intervaloCheck: any;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.isDesktop.set(window.innerWidth > 912);
      this.verificarEstadoChat();
      this.intervaloCheck = setInterval(() => {
        this.verificarEstadoChat();
      }, 20000);
    }
  }

  verificarEstadoChat() {
    this.analisisService.comprobarEstadoChat().subscribe(estado => {
      const estabaOffline = !this.enLinea();
      this.enLinea.set(estado);
      
      if (!estado && this.mensajes().length === 1) {
        this.mensajes.set([
          { role: 'assistant', content: this.translate.instant('CHAT.ERROR') }
        ]);
      } else if (estado && estabaOffline && this.mensajes().length === 1 && this.mensajes()[0].content === this.translate.instant('CHAT.ERROR')) {
        this.mensajes.set([
          { role: 'assistant', content: this.translate.instant('CHAT.BIENVENIDA') }
        ]);
      }
    });
  }

  toggleChat() {
    this.abierto.update(v => !v);
    this.actualizarLayoutGlobal(true);
    this.scrollToBottom();
    
    if (this.abierto() && !this.enLinea()) {
      this.verificarEstadoChat();
    }
  }

  actualizarLayoutGlobal(animar: boolean) {
    if (isPlatformBrowser(this.platformId)) {
      if (animar) {
        document.body.style.transition = 'padding-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      } else {
        document.body.style.transition = 'none';
      }

      if (this.abierto() && this.isDesktop()) {
        document.body.style.paddingRight = `${this.anchoChat()}px`;
      } else {
        document.body.style.paddingRight = '0px';
      }
    }
  }

  iniciarArrastre(event: MouseEvent) {
    this.arrastrando.set(true);
    event.preventDefault();
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }
  }

  @HostListener('document:mousemove', ['$event'])
  alArrastrar(event: MouseEvent) {
    if (!this.arrastrando() || !isPlatformBrowser(this.platformId)) return;
    
    const nuevoAncho = window.innerWidth - event.clientX;
    const anchoMaximo = window.innerWidth * 0.55;
    
    if (nuevoAncho >= 320 && nuevoAncho <= anchoMaximo) {
      this.anchoChat.set(nuevoAncho);
      this.actualizarLayoutGlobal(false);
    }
  }

  @HostListener('document:mouseup')
  pararArrastre() {
    if (this.arrastrando() && isPlatformBrowser(this.platformId)) {
      this.arrastrando.set(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (isPlatformBrowser(this.platformId)) {
      this.isDesktop.set(window.innerWidth > 912);
      this.actualizarLayoutGlobal(false);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.myScrollContainer) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  enviarMensaje() {
    const texto = this.mensajeInput().trim();
    if (!texto || this.cargando()) return;

    const nuevoMensaje: MensajeChat = { role: 'user', content: texto };
    this.mensajes.update(msgs => [...msgs, nuevoMensaje]);
    this.mensajeInput.set('');
    this.cargando.set(true);
    this.mostrandoTyping.set(true);

    const historialParaBackend = this.mensajes().filter(m => m.content !== this.translate.instant('CHAT.BIENVENIDA'));
    historialParaBackend.pop();
    let indiceRespuesta = -1;

    this.analisisService.enviarMensajeChatStream(this.jobId, {
      mensaje: texto,
      historial: historialParaBackend
    }).subscribe({
      next: (fragmento) => {
        if (indiceRespuesta === -1) {
          this.mostrandoTyping.set(false);
          this.mensajes.update(msgs => [...msgs, { role: 'assistant', content: '' }]);
          indiceRespuesta = this.mensajes().length - 1;
        }
        this.mensajes.update(msgs => {
          const copia = [...msgs];
          copia[indiceRespuesta] = {
            ...copia[indiceRespuesta],
            content: copia[indiceRespuesta].content + fragmento
          };
          return copia;
        });
      },
      error: () => {
        this.mostrandoTyping.set(false);
        this.mensajes.update(msgs => [...msgs, { role: 'assistant', content: this.translate.instant('CHAT.ERROR') }]);
        this.cargando.set(false);
      },
      complete: () => {
        this.mostrandoTyping.set(false);
        this.cargando.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.intervaloCheck) {
      clearInterval(this.intervaloCheck);
    }

    if (isPlatformBrowser(this.platformId)) {
      document.body.style.transition = 'padding-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      document.body.style.paddingRight = '0px';
    }
  }
}