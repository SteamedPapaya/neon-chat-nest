import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';

@WebSocketGateway({ cors: true })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ChatGateway');

  private redisPublisher = new Redis(); // Redis 클라이언트 생성 (Publisher)
  private redisSubscriber = new Redis(); // Redis 클라이언트 생성 (Subscriber)

  constructor() {
    // Redis 구독 설정 (채널: 'chat')
    this.redisSubscriber.subscribe('chat', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe: ', err.message);
      } else {
        this.logger.log(`Subscribed successfully! This client is currently subscribed to ${count} channels.`);
      }
    });

    // Redis 메시지를 수신하여 WebSocket 클라이언트에 브로드캐스트
    this.redisSubscriber.on('message', (channel, message) => {
      this.server.emit('message', message);
    });
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: { sender: string; message: string }): void {
    const { sender, message } = payload;
    const formattedMessage = `${sender}: ${message}`;
    
    // Redis에 메시지 발행 (채널: 'chat')
    this.redisPublisher.publish('chat', formattedMessage);
  }
}