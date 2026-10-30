import { Component, ChangeDetectionStrategy, inject, ChangeDetectorRef, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UpperCasePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Autenticar } from '../../services/autenticar';
import { Usuario } from '../../compartido/usuario';
import { Registro } from '../registro/registro';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCheckboxModule, MatIcon, TranslatePipe, MatTooltipModule, 
    UpperCasePipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  private fb = inject(FormBuilder);
  private autenticarService = inject(Autenticar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  ocultarPassword = signal(true);
  dialogRef = inject(MatDialogRef<Login>);
  private dialogo = inject(MatDialog);
  errorMensaje: string | null = null; 

  formularioLogin = this.fb.group({
    nombre: ['', Validators.required],
    password: ['', Validators.required],
    nocerrar: [false]
  });

  onSubmit(): void {
    if (this.formularioLogin.invalid) {
      return;
    }
    
    this.errorMensaje = null; 
    const valores = this.formularioLogin.getRawValue();
    const usuario: Usuario = {
      user: valores.nombre ?? '',
      contrasenya: valores.password ?? '',
      nocerrar: valores.nocerrar ?? false
    };

    this.autenticarService.login(usuario).subscribe({
        next: (usuarioLogueado) => {
          if (usuarioLogueado) {
            this.dialogRef.close(usuarioLogueado);
            this.router.navigate(['/inicio']);
          } else {
            this.formularioLogin.get('password')?.reset();
          }
        },
        error: (error) => {
          console.error('Error servidor:', error);
          this.formularioLogin.get('password')?.reset();
          this.errorMensaje = this.translate.instant('LOGIN.ERROR_CREDENCIALES');
          this.cdr.markForCheck(); 
        }
      });
  }

  abrirRegistro(): void {
    this.dialogRef.close();
    this.dialogo.open(Registro, {
      width: '550px',
      maxHeight: '85vh',
      panelClass: 'custom-dialog-container',
      disableClose: false
    });
  }
}