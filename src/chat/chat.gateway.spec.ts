import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { RedisMemoryServer } from 'redis-memory-server';
import Redis from 'ioredis';
import { Socket } from 'socket.io';
import { Server } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let redisServer: RedisMemoryServer;
  let redisPublisher: Redis;
  let redisSubscriber: Redis;
  let mockSocket: Socket;
  let mockServer: Server;

  beforeAll(async () => {
    // Redis in-memory 서버 시작
    redisServer = new RedisMemoryServer();
    // const redisPort = await redisServer.getPort();
    const redisPort = 6379;
    
    const redisUrl = `redis://127.0.0.1:${redisPort}`;
    redisPublisher = new Redis(redisUrl);
    redisSubscriber = new Redis(redisUrl);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatGateway],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);

    // WebSocket 서버 모킹
    mockServer = {
      emit: jest.fn(), // emit 함수를 모킹하여 테스트에서 사용할 수 있도록 설정
    } as unknown as Server;

    // 모킹한 서버를 게이트웨이에 설정
    gateway.server = mockServer;
  });

  afterAll(async () => {
    // Redis 서버 종료
    await redisPublisher.quit();
    await redisSubscriber.quit();
    await redisServer.stop();
  });

  it('should handle WebSocket connections', () => {
    // WebSocket 클라이언트 연결 시나리오
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn(),
    } as unknown as Socket;

    gateway.handleConnection(mockSocket);
    expect(mockSocket.emit).toHaveBeenCalledTimes(0); // 연결 시 바로 메시지를 보내지 않음
  });

  it('should broadcast messages using Redis', (done) => {
    const testMessage = { sender: 'John', message: 'Hello World' };
  
    // Redis 구독이 완료된 후에 메시지 발행
    redisSubscriber.subscribe('chat', (err, count) => {
      if (err) {
        console.error('Failed to subscribe:', err);
        done(err); // 구독 실패 시 테스트 종료
      } else {
        console.log(`Subscribed successfully to ${count} channels`);
  
        // 구독 후 메시지 발행
        gateway.handleMessage(mockSocket, testMessage);
        console.log('Message published'); // 메시지 발행 후 로그
  
        // Redis에서 메시지 수신 (디버깅을 위한 로그 추가)
        redisSubscriber.on('message', (channel, message) => {
          console.log(`Received message on channel ${channel}: ${message}`);
  
          try {
            expect(message).toBe(`${testMessage.sender}: ${testMessage.message}`);
            expect(mockServer.emit).toHaveBeenCalledWith('message', `${testMessage.sender}: ${testMessage.message}`);
            done(); // 테스트 종료
          } catch (error) {
            done(error); // 에러 발생 시 테스트 종료
          }
        });
      }
    });
  }, 10000); // 타임아웃 30초로 설정
});