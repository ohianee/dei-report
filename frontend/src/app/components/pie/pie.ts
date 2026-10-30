import { Component, OnInit } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelope, faCodeBranch, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { faGithub, faLinkedin, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-pie',
  imports: [FontAwesomeModule, RouterLink, TranslatePipe],
  templateUrl: './pie.html',
  styleUrl: './pie.scss',
})
export class Pie implements OnInit {
  faEnvelope = faEnvelope;
  faCodeBranch = faCodeBranch;
  faChartPie = faChartPie;
  faGithub = faGithub;
  faLinkedin = faLinkedin;
  faTwitter = faTwitter;

  constructor() { }
  ngOnInit(): void { }
}