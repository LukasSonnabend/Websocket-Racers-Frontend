import { Injectable, Signal, signal } from '@angular/core';
import { Observable, Observer } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket!: WebSocket;
  private onOpenCallbacks: (() => void)[] = [];
  public messageSignal = signal<any>(null);

  constructor() { }

  connect(url: string): Observable<Event> {
    return new Observable((observer: Observer<Event>) => {
      this.socket = new WebSocket(url);

      this.socket.onopen = (event) => {
        console.log('WebSocket connection opened:', event);
        observer.next(event);
        this.onOpenCallbacks.forEach(callback => callback());
        this.onOpenCallbacks = [];
      };

      this.socket.onmessage = (event) => {
        // console.log('WebSocket message received:', event.data);
        this.messageSignal.set(JSON.parse(event.data));
      };

      this.socket.onerror = (event) => {
        console.error('WebSocket error:', event);
        observer.error(event);
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event);
        observer.complete();
      };

      // Cleanup on unsubscribe
      return () => {
        if (this.socket) {
          this.socket.close();
        }
      };
    });
  }

  onOpen(callback: () => void): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      callback();
    } else {
      this.onOpenCallbacks.push(callback);
    }
  }

  registerAsHost(): void {
    this.onOpen(() => {
      this.socket.send(JSON.stringify({ type: 'register', role: 'host' }));
    });
  }

  registerAsPlayer(playerName: string): void {
    this.onOpen(() => {
      this.socket.send(JSON.stringify({ type: 'register', role: 'client', value: { playerName } }));
    });
  }

  get getMessages(): Signal<any> {
    return this.messageSignal;
  }

  send(message: any): void {
    this.onOpen(() => {
      this.socket.send(JSON.stringify(message));
    });
  }
}