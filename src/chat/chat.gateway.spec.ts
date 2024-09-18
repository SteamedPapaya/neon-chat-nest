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
    const redisPort = await redisServer.getPort();

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

  it('should broadcast messages using Redis', async () => {
    const testMessage = { sender: 'John', message: 'Hello World' };

    // 메시지 발행
    gateway.handleMessage(mockSocket, testMessage);

    // 메시지 수신을 기다리기 위한 비동기 처리
    await new Promise<void>((resolve) => {
      redisSubscriber.on('message', (channel, message) => {
        expect(message).toBe(`${testMessage.sender}: ${testMessage.message}`);
        resolve();
      });
    });

    // WebSocket 서버가 emit을 호출했는지 확인
    expect(mockServer.emit).toHaveBeenCalledWith('message', `${testMessage.sender}: ${testMessage.message}`);
  });
});