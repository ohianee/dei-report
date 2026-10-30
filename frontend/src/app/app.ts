import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Cabecera } from './components/cabecera/cabecera';
import { Pie } from './components/pie/pie';
import { AccesibilidadDei } from './components/accesibilidad-dei/accesibilidad-dei';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Cabecera, Pie, AccesibilidadDei],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('deiReport');
}
