import type { Message, MessageFilter } from "../../entities/Message"

export type MessageHandler = (message: Message) => Promise<void>
export type Unsubscribe = () => void

export interface MessagePort {
  emit(message: Message): Promise<void>
  subscribe(filter: MessageFilter, handler: MessageHandler): Unsubscribe
}
