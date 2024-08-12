import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { WebsocketService } from '../websocket.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss'
})
export class PlayerComponent implements OnInit, OnDestroy, AfterViewInit {
  playerName: string | null = null;
  isConnected = false;
  private readonly maxRetries = 5;
  private retryCount = 0;
  private gyroInterval: any;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  alpha: number | null = null;
  beta: number | null = null;
  gamma: number | null = null;

  private baselineAlpha: number | null = null;
  private baselineBeta: number | null = null;
  private baselineGamma: number | null = null;

  constructor(private websocketService: WebsocketService) { }

  ngOnInit(): void {
    this.playerName = window.prompt('Please enter your name:', '');
    if (this.playerName) {
      this.attemptConnection();
      this.checkGyroscope();
    } else {
      console.log('Player name is required to connect.');
    }
  }

  ngAfterViewInit(): void {
    this.canvas = document.getElementById('gyroCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d');
  }

  ngOnDestroy(): void {
    if (this.gyroInterval) {
      clearInterval(this.gyroInterval);
    }
  }

  private attemptConnection(): void {
    this.websocketService.connect('ws://localhost:8080').subscribe({
      next: () => {
        this.websocketService.registerAsPlayer(this.playerName!);
        this.isConnected = true; // Set connection status to true
        this.retryCount = 0; // Reset retry count on successful connection
      },
      error: (err) => {
        console.error('Connection failed:', err);
        this.isConnected = false; // Set connection status to false
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`Retrying connection (${this.retryCount}/${this.maxRetries})...`);
          setTimeout(() => this.attemptConnection(), 2000); // Retry after 2 seconds
        } else {
          console.log('Max retries reached. Could not connect.');
        }
      }
    });
  }

  private checkGyroscope(): void {
    if ('DeviceOrientationEvent' in window) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        // iOS 13+ requires permission to access gyroscope
        (DeviceOrientationEvent as any).requestPermission()
          .then((response: string) => {
            if (response === 'granted') {
              this.startGyroscope();
            } else {
              console.log('Permission to access gyroscope was denied.');
            }
          })
          .catch(console.error);
      } else {
        // Non-iOS devices or iOS versions below 13
        this.startGyroscope();
      }
    } else {
      console.log('Device does not support gyroscope.');
    }
  }

  private startGyroscope(): void {
    this.gyroInterval = setInterval(() => {
      window.addEventListener('deviceorientation', this.handleOrientation, { once: true });
    }, 200);
  }

  private handleOrientation = (event: DeviceOrientationEvent): void => {
    this.alpha = event.alpha;
    this.beta = event.beta;
    this.gamma = event.gamma;

    if (this.baselineAlpha !== null && this.baselineBeta !== null && this.baselineGamma !== null) {
      this.alpha = (this.alpha !== null ? this.alpha - this.baselineAlpha : null);
      this.beta = (this.beta !== null ? this.beta - this.baselineBeta : null);
      this.gamma = (this.gamma !== null ? this.gamma - this.baselineGamma : null);
    }

    console.log(`Alpha: ${this.alpha}, Beta: ${this.beta}, Gamma: ${this.gamma}`);
    this.drawGyroData();
  }

  private drawGyroData(): void {
    if (!this.ctx || !this.canvas) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const horizonY = centerY + (this.gamma ? this.gamma : 0) * 2; // Adjust the multiplier as needed

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw horizon line
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizonY);
    this.ctx.lineTo(this.canvas.width, horizonY);
    this.ctx.strokeStyle = 'blue';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw vertical line
    const verticalX = centerX + (this.beta ? this.beta : 0) * 2; // Adjust the multiplier as needed
    this.ctx.beginPath();
    this.ctx.moveTo(verticalX, 0);
    this.ctx.lineTo(verticalX, this.canvas.height);
    this.ctx.strokeStyle = 'red';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
}

  calibrateGyro(): void {
    this.baselineAlpha = (this.alpha || 0);
    this.baselineBeta = (this.beta || 0);
    this.baselineGamma = (this.gamma || 0);
  }

  setReady(): void {
    this.websocketService.send({ type: 'ready', value: { playerName: this.playerName } });
  }
}