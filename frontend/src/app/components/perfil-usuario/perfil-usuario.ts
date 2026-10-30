import { Component, ChangeDetectionStrategy, inject, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Autenticar } from '../../services/autenticar';
import { UsuarioPerfil } from '../../compartido/usuario';

export function contrasenyasIguales(control: AbstractControl): ValidationErrors | null {
  const pass = control.get('passNueva');
  const repite = control.get('passRepite');
  if (pass && repite && pass.value !== repite.value) {
    return { noCoinciden: true };
  }
  return null;
}

@Component({
  selector: 'app-perfil-usuario',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTabsModule, TranslatePipe, MatTooltipModule, UpperCasePipe],
  templateUrl: './perfil-usuario.html',
  styleUrl: './perfil-usuario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilUsuario implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(Autenticar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  dialogRef = inject(MatDialogRef<PerfilUsuario>);

  ocultarActual = signal(true);
  ocultarNueva = signal(true);
  ocultarRepite = signal(true);
  ocultarBorrar = signal(true);

  perfil: UsuarioPerfil | null = null;
  mensajeExito: string | null = null;
  mensajeError: string | null = null;
  errorBorrado: string | null = null;
  mensajeGithub: string | null = null;

  formPassword = this.fb.group({
    passActual: ['', Validators.required],
    passNueva: ['', [Validators.required, Validators.minLength(4)]],
    passRepite: ['', Validators.required]
  }, { validators: contrasenyasIguales });

  formBorrar = this.fb.group({
    passwordConfirm: ['', Validators.required]
  });

  ngOnInit() {
    this.authService.obtenerPerfil().subscribe({
      next: (datos) => {
        this.perfil = datos;
        this.cdr.markForCheck();
      },
      error: () => this.dialogRef.close()
    });

    const resultadoGithub = this.route.snapshot.queryParamMap.get('github');
    if (resultadoGithub) {
      this.mensajeGithub = resultadoGithub === 'conectado'
        ? null
        : this.translate.instant('PERFIL.GITHUB_ERROR');
      if (resultadoGithub === 'conectado') {
        this.mensajeExito = this.translate.instant('PERFIL.GITHUB_EXITO');
      }
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  conectarGithub() {
    this.authService.conectarGithub();
  }

  desconectarGithub() {
    this.mensajeGithub = null;
    this.authService.desconectarGithub().subscribe({
      next: () => {
        this.authService.obtenerPerfil().subscribe(datos => {
          this.perfil = datos;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.mensajeGithub = this.translate.instant('PERFIL.GITHUB_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  cambiarPassword() {
    if (this.formPassword.invalid) return;
    this.mensajeError = null;
    this.mensajeExito = null;

    const datos = {
      contrasenya_actual: this.formPassword.value.passActual!,
      contrasenya_nueva: this.formPassword.value.passNueva!
    };

    this.authService.actualizarPassword(datos).subscribe({
      next: () => {
        this.mensajeExito = this.translate.instant('PERFIL.EXITO_PASS');
        this.formPassword.reset();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.mensajeError = this.translate.instant('PERFIL.ERROR_PASS');
        this.cdr.markForCheck();
      }
    });
  }

  borrarCuenta() {
    if (this.formBorrar.invalid || !this.perfil) return;
    this.errorBorrado = null;

    const confirmacion = confirm(this.translate.instant('PERFIL.CONFIRMAR_BORRADO_ALERTA'));
    if (!confirmacion) return;

    const credenciales = {
      user: this.perfil.user,
      contrasenya: this.formBorrar.value.passwordConfirm!,
      nocerrar: false
    };

    this.authService.borrarCuenta(credenciales).subscribe({
      next: () => {
        this.authService.cerrarSesion();
        this.dialogRef.close();
        this.router.navigate(['/inicio']);
      },
      error: (err) => {
        this.errorBorrado = this.translate.instant('PERFIL.ERROR_BORRAR');
        this.cdr.markForCheck();
      }
    });
  }
}