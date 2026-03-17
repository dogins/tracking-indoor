import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';

interface PackageManifest {
  version?: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {
  private readonly http = inject(HttpClient);

  readonly deployedVersion = signal('dev');

  constructor() {
    this.http.get<PackageManifest>('package.json').subscribe({
      next: (manifest) => {
        this.deployedVersion.set(manifest.version?.trim() || 'unknown');
      },
      error: () => {
        this.deployedVersion.set('unknown');
      },
    });
  }
}
