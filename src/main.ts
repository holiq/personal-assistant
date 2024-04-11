import { WhatsappConnectionService } from '@app/whatsapp';
import { WhatsappActionModule } from '@app/whatsapp-action';
import { ScanQrCodeAction } from '@app/whatsapp-action/scan-qr-code.action';
import { NestFactory } from '@nestjs/core';
import * as inquirer from 'inquirer';
import { AppModule } from 'src/app.module';

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);
  // await app.listen(3000);
  // await CommandFactory.run(AppModule);

  if (process.argv.includes('--login')) {
    const inputs = await inquirer.prompt([
      {
        type: 'input',
        name: 'deviceName',
        message: 'What is your device name?',
      },
    ]);
    if (!inputs.deviceName) {
      console.error('Device name is required');
      return;
    }

    const loginApp = await NestFactory.createApplicationContext(AppModule);

    const service = loginApp.select(WhatsappActionModule).get(ScanQrCodeAction);
    await service.scan(inputs.deviceName);

    await loginApp.close();
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  const whatsappConnection = app.get(WhatsappConnectionService);
  whatsappConnection.connectingAllDevice();

  await app.close();
}

bootstrap();
