import { Component, ChangeDetectionStrategy, inject, ChangeDetectorRef, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UpperCasePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Autenticar } from '../../services/autenticar';
import { Usuario } from '../../compartido/usuario';
import { Login } from '../login/login';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIcon, TranslatePipe, MatTooltipModule, UpperCasePipe],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Registro {
  private fb = inject(FormBuilder);
  private autenticarService = inject(Autenticar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  ocultarPassword = signal(true);
  ocultarRepetirPassword = signal(true);
  dialogRef = inject(MatDialogRef<Registro>);
  private dialogo = inject(MatDialog);
  errorMensaje: string | null = null;
  enviando = false;

  formularioRegistro = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    passwordRepetir: ['', Validators.required]
  }, { validators: this.contrasenyasCoinciden });

  private contrasenyasCoinciden(grupo: any) {
    const password = grupo.get('password')?.value;
    const repetir = grupo.get('passwordRepetir')?.value;
    return password === repetir ? null : { noCoinciden: true };
  }

  onSubmit(): void {
    if (this.formularioRegistro.invalid) {
      this.formularioRegistro.markAllAsTouched();
      return;
    }

    this.errorMensaje = null;
    this.enviando = true;
    const valores = this.formularioRegistro.getRawValue();
    const usuario: Usuario = {
      user: valores.nombre ?? '',
      contrasenya: valores.password ?? '',
      nocerrar: false
    };

    this.autenticarService.registro(usuario).subscribe({
      next: () => {
        this.autenticarService.login(usuario).subscribe({
          next: (usuarioLogueado) => {
            this.enviando = false;
            this.dialogRef.close(usuarioLogueado);
            this.router.navigate(['/inicio']);
          },
          error: () => {
            this.enviando = false;
            this.dialogRef.close('registrado');
          }
        });
      },
      error: (error) => {
        this.enviando = false;
        if (typeof error === 'string' && error.startsWith('400')) {
          this.errorMensaje = this.translate.instant('REGISTRO.ERROR_USUARIO_EXISTE');
        } else {
          this.errorMensaje = this.translate.instant('REGISTRO.ERROR_GENERICO');
        }
        this.cdr.markForCheck();
      }
    });
  }

  abrirLogin(): void {
    this.dialogRef.close();
    this.dialogo.open(Login, {
      width: '550px',
      maxHeight: '85vh',
      panelClass: 'custom-dialog-container',
      disableClose: false
    });
  }
}