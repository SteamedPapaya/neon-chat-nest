import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // public 폴더에서 정적 파일 제공
  app.useStaticAssets(join(__dirname, '..', 'public')); 
  
  await app.listen(3000);
}
bootstrap();
