import { MessageUpsertType, proto } from '@adiwajshing/baileys'
import { HandlerArgs } from '../Contracts/IEventListener'
import { MessageUpsert } from '../Facades/Events/Message/MessageUpsert'
import Queue from '../Facades/Queue'

export class KickAllMember extends MessageUpsert {
  patterns: string | false | RegExp | (string | RegExp)[] = ['.kickmember']
  chat: 'all' | 'group' | 'user' = 'group'
  async handler({
    socket,
    props: upsert,
  }: HandlerArgs<{
    message: proto.IWebMessageInfo
    type: MessageUpsertType
  }>): Promise<void> {
    const jid = upsert.message.key.remoteJid || ''
    const participants = (await socket.groupMetadata(jid)).participants
    const members = participants.filter((p) => !p.admin).map((p) => p.id)
    // const admins = participants.filter(p => !!p.admin).map(p => p.id)
    try {
      Queue(() => {
        socket.groupParticipantsUpdate(jid, members, 'remove')
      })
    } catch (error) {}
  }
}
