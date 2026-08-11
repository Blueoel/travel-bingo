import { Global, Module } from "@nestjs/common";

import { MissionQrService } from "./mission-qr.service.js";

@Global()
@Module({
  providers: [MissionQrService],
  exports: [MissionQrService],
})
export class QrModule {}
