import { Component, OnInit, inject, effect } from '@angular/core';
import { WebsocketService } from '../websocket.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// {"type":"new_client","message":"A new client has connected"}
export enum MessageTypes {
  NewClient = 'new_client',
  ClientDisconnected = 'client_disconnected',
  GameStarted = 'game_started',
  PlayerReady = 'player_ready',
  GameEnded = 'game_ended',
  Controls = 'player_controls'
}

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './host.component.html',
  styleUrls: ['./host.component.scss']
})
export class HostComponent implements OnInit {

  private websocketService = inject(WebsocketService);
  public latestMessage: any = null;

  protected players: { playerName: string, ready: boolean, playerId: string }[] = [];

  constructor(private router: Router) {
    // Run the effect within the constructor to ensure it's within the Angular injection context
    effect(() => {
      const msg: { type: MessageTypes, message: string } = this.websocketService.getMessages();
      if (msg?.type) {
        this.handleMessage(msg);
      }
    });
  }

  ngOnInit(): void {
    // Connect to the WebSocket server and register as a host
    this.websocketService.connect('ws://192.168.2.140:8080').subscribe({
      next: () => {
        this.websocketService.registerAsHost();
      },
      error: (err) => {
        console.error('Connection failed:', err);
        // Handle connection error
      },
      complete: () => {
        console.log('Connection closed');
        // Handle connection close
      }
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case MessageTypes.NewClient:
        console.log('New client connected:', message.data);
        this.players.push(message.data);
        break;
      case MessageTypes.ClientDisconnected:
        console.log('Client disconnected:', message.data);
        this.players = this.players.filter(player => player.playerId !== message.data.playerId);
        break;
      case MessageTypes.GameStarted:
        console.log('Game started:', message.data);
        break;


      case MessageTypes.PlayerReady:
        console.log('Player ready:', message.data);
        const player = this.players.find(p => p.playerId === message.data.playerId);
        if (player) {
          player.ready = true;
        }
        if (this.players.every(p => p.ready)) {
          this.router.navigate(['/race']);
        }
        break
      case MessageTypes.GameEnded:
        console.log('Game ended:', message.data);
        break;
      default:
        console.log('Unknown message type:', message);
    }
  }
}