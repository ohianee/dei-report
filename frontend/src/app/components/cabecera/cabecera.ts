import { Component, Inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHome, faChartBar, faHistory, faSignInAlt, faSignOutAlt, faUser, faBars, 
  faTimes, faQuestionCircle, faGlobe, faUserCog } from '@fortawesome/free-solid-svg-icons';
import { MatDialog } from '@angular/material/dialog';
import { UpperCasePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { Login } from '../login/login';
import { GuiaAyuda } from '../guia-ayuda/guia-ayuda';
import { Autenticar } from '../../services/autenticar';
import { Usuario } from '../../compartido/usuario';
import { Idioma } from '../../services/idioma';
import { PerfilUsuario } from '../perfil-usuario/perfil-usuario';

@Component({
  selector: 'app-cabecera',
  imports: [RouterLink, RouterLinkActive, UpperCasePipe, MatToolbarModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatTooltipModule, FontAwesomeModule, TranslatePipe],
  templateUrl: './cabecera.html',
  styleUrl: './cabecera.scss',
})
export class Cabecera implements OnInit {
  
  faHome = faHome;
  faChartBar = faChartBar;
  faHistory = faHistory;
  faSignInAlt = faSignInAlt;
  faSignOutAlt = faSignOutAlt;
  faUser = faUser;
  faBars = faBars;
  faTimes = faTimes;
  faQuestionCircle = faQuestionCircle;
  faGlobe = faGlobe;
  faUserCog = faUserCog;
  
  isBrowser = signal(false);
  menuAbierto = false;

  constructor(
    public dialogo: MatDialog,
    public authService: Autenticar,
    public idiomaService: Idioma,
    @Inject('baseURL') public BaseURL: string,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.isBrowser.set(isPlatformBrowser(this.platformId));
    if (this.isBrowser() && this.route.snapshot.queryParamMap.has('github')) {
      this.abrirPerfil();
    }
  }

  get usuario(): Usuario | undefined {
    return this.authService.usuarioLogueado();
  }

  abrirFormularioLogin() {
    if (this.dialogo.openDialogs.length > 0) return;
    this.dialogo.open(Login, {
      width: '550px',
      maxHeight: '85vh',
      panelClass: 'custom-dialog-container',
      disableClose: false,
      restoreFocus: false
    });
  }

  abrirGuiaAyuda() {
    if (this.dialogo.openDialogs.length > 0) return;
    this.dialogo.open(GuiaAyuda, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '85vh',
      panelClass: 'custom-dialog-container',
      disableClose: false
    });
  }

  abrirPerfil() {
    if (this.dialogo.openDialogs.length > 0) return;
    this.dialogo.open(PerfilUsuario, {
      width: '550px',
      maxHeight: '85vh',
      panelClass: 'custom-dialog-container',
      disableClose: false
    });
  }

  cambiarIdioma(lang: string) {
    this.idiomaService.cambiarIdioma(lang);
  }

  logout() {
    this.authService.cerrarSesion();
    this.router.navigate(['/inicio']);
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarMenu() {
    this.menuAbierto = false;
  }
}