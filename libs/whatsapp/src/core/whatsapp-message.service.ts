import {
  EligibleMetadataKey,
  WhatsappMessageAction,
  WhatsappMessageActionMetadataKey,
  WhatsappMessageActionOptions,
  getMessageCaption,
  patternsAndTextIsMatch,
} from '@app/whatsapp';
import {
  DiscoveryService,
  type DiscoveredClassWithMeta,
} from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import type {
  BaileysEventMap,
  WAMessage,
  WASocket,
} from '@whiskeysockets/baileys';

@Injectable()
export class WhatsappMessageService {
  constructor(private readonly discoveryService: DiscoveryService) {}

  async execute(
    socket: WASocket,
    { messages, type }: BaileysEventMap['messages.upsert'],
  ) {
    const providers = await this.discoveryService.providersWithMetaAtKey(
      WhatsappMessageActionMetadataKey,
    );
    providers.map(async (provider) => {
      const instance = provider.discoveredClass
        .instance as WhatsappMessageAction;
      const meta = provider.meta as WhatsappMessageActionOptions;

      for (const message of messages) {
        const caption = getMessageCaption(message.message);

        const isEligible = await this.eligibleMapInstance(
          provider,
          socket,
          message,
        );

        if (!isEligible) continue;

        if (typeof meta.flags !== 'undefined') {
          if (patternsAndTextIsMatch(meta.flags, caption)) {
            instance.execute(socket, message);
          }
        } else {
          instance.execute(socket, message);
        }
      }
    });
  }

  protected async eligibleMapInstance(
    provider: DiscoveredClassWithMeta<unknown>,
    socket: WASocket,
    message: WAMessage,
  ) {
    const eligibles = await this.discoveryService.providerMethodsWithMetaAtKey(
      EligibleMetadataKey,
      (found) => found.name === provider.discoveredClass.name,
    );

    let result = true;

    await Promise.all(
      eligibles.map(async (eligible) => {
        const instance = await eligible.discoveredMethod.handler(
          socket,
          message,
        );
        if (!instance) result = false;
      }),
    );

    return result;
  }
}
