import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { WebsocketService } from '../websocket.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent implements OnInit, OnDestroy, AfterViewInit {
  playerName: string | null = "Hubertus Simplex";
  isConnected = false;
  private readonly maxRetries = 5;
  private retryCount = 0;
  private gyroInterval: any;
  private gyroCanvas: HTMLCanvasElement | null = null;
  private gyroCtx: CanvasRenderingContext2D | null = null;
  private airspeedCanvas: HTMLCanvasElement | null = null;
  private airspeedCtx: CanvasRenderingContext2D | null = null;

  alpha: number | null = null;
  beta: number | null = null;
  gamma: number | null = null;

  private baselineAlpha: number | null = null;
  private baselineBeta: number | null = null;
  private baselineGamma: number | null = null;
  // Variables to store previous smoothed values
  private smoothedAlpha: number | null = null;
  private smoothedBeta: number | null = null;
  private smoothedGamma: number | null = null;
  
  constructor(private websocketService: WebsocketService) { }

  ngOnInit(): void {
    this.playerName = window.prompt('Please enter your name:', '') || "Hubertus Simplex";
    if (this.playerName) {
      this.attemptConnection();
      this.checkGyroscope();
    } else {
      console.log('Player name is required to connect.');
    }
  }

  ngAfterViewInit(): void {
    this.gyroCanvas = document.getElementById('gyroCanvas') as HTMLCanvasElement;
    this.gyroCtx = this.gyroCanvas.getContext('2d');
    this.airspeedCanvas = document.getElementById('airspeedCanvas') as HTMLCanvasElement;
    this.airspeedCtx = this.airspeedCanvas.getContext('2d');
  }

  ngOnDestroy(): void {
    if (this.gyroInterval) {
      clearInterval(this.gyroInterval);
    }
  }

  private attemptConnection(): void {
    this.websocketService.connect('ws://192.168.2.140:8080').subscribe({
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

    // Smoothing factor (0 < smoothingFactor < 1)
    private readonly smoothingFactor = 0.1;

  private applyLowPassFilter(previousValue: number | null, currentValue: number | null): number | null {
    if (previousValue === null || currentValue === null) {
      return currentValue;
    }
    return previousValue + this.smoothingFactor * (currentValue - previousValue);
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
    }, 50);
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

    // Apply low-pass filter to smooth the readings
    this.smoothedAlpha = this.applyLowPassFilter(this.smoothedAlpha, this.alpha);
    this.smoothedBeta = this.applyLowPassFilter(this.smoothedBeta, this.beta);
    this.smoothedGamma = this.applyLowPassFilter(this.smoothedGamma, this.gamma);

    console.log(`Alpha: ${this.smoothedAlpha}, Beta: ${this.smoothedBeta}, Gamma: ${this.smoothedGamma}`);
    this.drawGyroData();
    this.drawAirspeedIndicator();
    this.sendControls();
  }

  private sendControls(): void {
    this.websocketService.send({
      type: 'controls',
      value: {
        alpha: this.smoothedAlpha,
        beta: this.smoothedBeta,
        gamma: this.smoothedGamma
      }
    });
  }

  private drawGyroData(): void {
    if (!this.gyroCtx || !this.gyroCanvas) return;

    const centerX = this.gyroCanvas.width / 2;
    const centerY = this.gyroCanvas.height / 2;
    const horizonY = centerY + (this.gamma ? this.gamma : 0) * 2; // Adjust the multiplier as needed

    this.gyroCtx.clearRect(0, 0, this.gyroCanvas.width, this.gyroCanvas.height);

    // Draw horizon line
    this.gyroCtx.beginPath();
    this.gyroCtx.moveTo(0, horizonY);
    this.gyroCtx.lineTo(this.gyroCanvas.width, horizonY);
    this.gyroCtx.strokeStyle = 'blue';
    this.gyroCtx.lineWidth = 2;
    this.gyroCtx.stroke();

    // Draw vertical line
    const verticalX = centerX + (this.beta ? this.beta : 0) * 2; // Adjust the multiplier as needed
    this.gyroCtx.beginPath();
    this.gyroCtx.moveTo(verticalX, 0);
    this.gyroCtx.lineTo(verticalX, this.gyroCanvas.height);
    this.gyroCtx.strokeStyle = 'red';
    this.gyroCtx.lineWidth = 2;
    this.gyroCtx.stroke();
  }

  private drawAirspeedIndicator(): void {
    if (!this.airspeedCtx || !this.airspeedCanvas) return;

    const width = this.airspeedCanvas.width;
    const height = this.airspeedCanvas.height;
    const centerY = height / 2;
    const bandHeight = height; // Height of the band
    const speed = this.alpha ? this.alpha : 0; // Use alpha as a placeholder for speed

    this.airspeedCtx.clearRect(0, 0, width, height);

    // Draw the band
    this.airspeedCtx.fillStyle = '#444';
    this.airspeedCtx.fillRect(0, centerY - bandHeight / 2, width, bandHeight);

    // Draw the speed indicator
    this.airspeedCtx.fillStyle = 'green';
    this.airspeedCtx.fillRect(0, centerY - 5, width, 10);

    // Draw speed numbers
    this.airspeedCtx.fillStyle = 'white';
    this.airspeedCtx.font = '20px Orbitron';
    this.airspeedCtx.textAlign = 'center';
    for (let i = -2; i <= 2; i++) {
      const y = centerY + i * 40;
      const speedValue = speed + i * 10;
      this.airspeedCtx.fillText(speedValue.toFixed(0), width / 2, y);
    }
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