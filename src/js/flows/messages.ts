// @ts-ignore
import autoBind from "auto-bind";
import Vue from "vue";

import Flows2 from "@/js/flows/main";
import STORE from "@/js/store";
import utils, { performanceLog } from "@/js/flows/utils";
import Message, { mapMessage, messageToDB } from "@/js/model/Message";
import { mapMessagesRead } from "@/js/model/MessagesRead";
import { mapMessageFlagged } from "@/js/model/MessagesFlagged";
import { SocketResult } from "@/js/socket";
import { FrameAction } from "@/js/flows/connection";

class Messages {
  flows: Flows2;
  store: STORE;
  events: Vue;
  shadowMessageId: number = 10000000;

  constructor(flows: Flows2) {
    this.flows = flows;
    this.store = flows.store;
    this.events = flows.events;

    this.setupMessageGetter();
    autoBind(this);
  }

  private setupMessageGetter() {
    this.store.flows._messages = JSON.parse(JSON.stringify(this.store.flows.messages || {}));
    const _messages = this.store.flows._messages;

    this.store.flows.messages = new Proxy({}, {
      get(target, prop: string) {
        if (prop === "keys") {
          return Object.keys(_messages);
        }
        if (!/^\d+$/.test(prop)) {
          console.warn("Invalid key:", prop);
          return undefined;
        }
        if (!Object.keys(_messages).includes(prop)) {
          Vue.set(_messages, prop, {v: 0});
          _messages[prop].d = [];
        }
        return _messages[prop];
      },
      ownKeys() {
        return Object.keys(_messages);
      },
    });
  }

  async getChatReadAndFlagged(chatId: number): Promise<SocketResult[]> {
    const subResponses = await Promise.all([
      this.flows.connection.subscribeChatTopic("TopicItemUserProperty", chatId),
      this.flows.connection.subscribeUserQueueChatTopic("TopicItemRead", chatId),
    ]);

    const promises = [];
    if (!subResponses[0][0].alreadyExists || !subResponses[0][1].alreadyExists) promises.push(this.flows.connection.findByChat("TopicItemUserProperty", chatId));
    if (!subResponses[1][0].alreadyExists || !subResponses[1][1].alreadyExists) promises.push(this.flows.connection.findByChat("TopicItemRead", chatId));

    return await Promise.all(promises);
  }

  async getChatFlagged(chatId: number): Promise<any> {
    const subResponse = await this.flows.connection.subscribeChatTopic("TopicItemUserProperty", chatId);

    if (!subResponse[0].alreadyExists || !subResponse[1].alreadyExists) {
      return this.flows.connection.findByChat("TopicItemUserProperty", chatId);
    }
    return Promise.resolve();
  }

  async getChatMessages(chatId: number, filter: chatFilter | null): Promise<Message[]> {
    this.flows.connection.subscribeChatTopic("TopicItem", chatId);

    return (await this.flows.connection.findByChat("TopicItem", chatId, filter)).body.map(mapMessage).sort((a: Message, b: Message) => a.id - b.id);
  }

  markMessagesAsRead(messageIds: number[], chatId: number): void {
    this.flows.connection.message("/app/TopicItemRead.markAsRead", {
      topicId: chatId,
      itemIds: messageIds,
    });
  }

  async setMessageFlagged(messageId: number, flagged: boolean): Promise<void> {
    this.flows.connection.message("/app/TopicItemUserProperty.save", {
      itemId: messageId,
      flag: +flagged,
    });
  }

  deleteMessage(message: Message): Promise<SocketResult> {
    if (message.type === "FILE" && message.url) this.flows.files.deleteFile(message.url);

    return this.flows.connection.messageWithResponse("/app/TopicItem.delete", {id: message.id});
  }

  async sendMessage(message: any, chatId: number) {
    if (!this.store.currentUser) throw new Error("No currentUser in store");

    message.creatorUserId = this.store.currentUser.id;
    message.topicId = chatId;
    message.customData = {test: true};

    const shadowId = this.shadowMessageId++;
    const shadowMessage = mapMessage(message);
    shadowMessage.id = shadowId;
    shadowMessage.shadow = true;
    shadowMessage.createDate = Date.now();
    shadowMessage.modifiedDate = shadowMessage.createDate;
    this.store.flows.messages[chatId].d.push(shadowMessage);
    this.store.flows.messages[chatId].v += 1;

    let error = false;
    let errorRecoverable = true;

    try {
      const result: SocketResult = await this.flows.connection.messageWithResponse("/app/TopicItem.save", message);
      if (result.type !== "TopicItem") throw new Error("Result not TopicItem");
    } catch (e) {
      if (e.type === "Error") {
        error = e.body.description ? e.body.description : "Could not send message";
        if (e.body.code === 401) {
          errorRecoverable = false;
        }
      } else {
        error = e;
      }
    } finally {
      const shadow = this.store.flows.messages[chatId].d.find(message => message.id === shadowId);
      if (shadow) {
        if (error) {
          shadow.error = error;
        }
        if (!error || !errorRecoverable) {
          this.store.flows.messages[chatId].d = this.store.flows.messages[chatId].d.filter(message => message.id !== shadowId);
        }
      }
      this.store.flows.messages[chatId].v += 1;
    }
  }

  async editMessage(message: Message): Promise<SocketResult> {
    const messageUpdate = messageToDB(message);
    delete messageUpdate.createDate;
    delete messageUpdate.modifiedDate;
    delete messageUpdate.creatorUserId;
    //messageUpdate.childFileIds = [];  //TODO: note sees olevad pildid, nende id mis saab kohe base64 uploadeides

    return this.flows.connection.messageWithResponse("/app/TopicItem.save", messageUpdate);
  }

  parseChatMessages(messages: any[], action: FrameAction) {
    const ids = messages.map(message => message.id);
    const chatId: number = messages.map(chat => chat.topicId).reduce((a, b) => (a === b) ? a : NaN);
    if (!chatId) throw new Error("Different or no chatIds in messages");

    if (action === "deleted") {
      this.store.flows.messages[chatId].d = this.store.flows.messages[chatId].d.filter(message => ids.indexOf(message.id) === -1);
      this.store.flows.messages[chatId].v += 1;
      return;
    }

    const mapped = messages.map(mapMessage);

    // @ts-ignore
    const childMessageIds: number[] = mapped.filter(message => message.parentTopicItemId).map(message => message.id);
    // Child messages (like email attachments) are marked as read automatically
    this.markMessagesAsRead(childMessageIds, chatId);

    this.store.flows.messages[chatId].d = this.store.flows.messages[chatId].d.filter(message => ids.indexOf(message.id) === -1);
    this.store.flows.messages[chatId].d = this.store.flows.messages[chatId].d.concat(mapped);
    this.store.flows.messages[chatId].d.sort((a, b) => a.id - b.id);
    this.store.flows.messages[chatId].v += 1;

    this.updateMessagesRead(chatId);
    this.updateMessagesFlagged(chatId);
  }

  parseChatMessagesRead(messagesRead: any[], action: FrameAction) {
    if (action === "deleted") {
      this.flows.deleteStoreArrayItems("messagesRead", messagesRead);
      return;
    }
    if (!this.store.currentUser) throw new Error("No currentUser in store");
    const currentUserId = this.store.currentUser.id;
    const mapped = messagesRead.map(mapMessagesRead).filter(x => x.userId === currentUserId);
    this.flows.updateStoreArray("messagesRead", mapped);

    const chatId: number = mapped.map(x => x.chatId).reduce((a, b) => (a === b) ? a : NaN);
    if (chatId) {
      this.updateMessagesRead(chatId);
      return;
    }
    this.updateMessagesRead();
  }

  parseChatMessagesFlagged(messagesFlagged: any[], action: FrameAction) {
    if (action === "deleted") {
      this.flows.deleteStoreArrayItems("messagesFlagged", messagesFlagged);
      return;
    }
    if (!this.store.currentUser) throw new Error("No currentUser in store");
    const currentUserId = this.store.currentUser.id;
    this.flows.updateStoreArray("messagesFlagged", messagesFlagged.filter(flagged => flagged.flag).map(mapMessageFlagged).filter(x => x.userId === currentUserId));

    const deleted = messagesFlagged.filter(flagged => !flagged.flag).map(mapMessageFlagged);
    this.flows.deleteStoreArrayItems("messagesFlagged", deleted);

    this.updateMessagesFlagged();
  }

  private _updateMessagesRead(chatId: number): void {
    if (!this.store.flows.messages[chatId].d.length) {
      return;
    }

    if (!this.flows.chats.currentUserMemberOfChat(chatId)) {
      this.store.flows.messages[chatId].d.map((message) => {
        message.unread = false;
      });
      this.store.flows.messages[chatId].v += 1;
      return;
    }

    let lastUnread = null;

    if (!this.store.flows.messagesRead.d.find(readRange => readRange.chatId === chatId)) {
      this.store.flows.messages[chatId].d.map((message) => {
        message.unread = true;
        lastUnread = message;
      });
    } else {
      this.store.flows.messages[chatId].d.map((message) => {
        message.unread = false;
        if (message.shadow) {
          return;
        }
        const inReadRange = this.store.flows.messagesRead.d.find(readRange => readRange.chatId === chatId && readRange.messageFrom <= message.id && readRange.messageTo >= message.id);
        if (!inReadRange) {
          message.unread = true;
          lastUnread = message;
        }
      });
    }
    this.store.flows.messages[chatId].v += 1;
    if (lastUnread) this.flows.notifications.messageNotification(lastUnread);
  }

  updateMessagesRead(chatId?: number): void {
    if (chatId) {
      this._updateMessagesRead(chatId);
    } else {
      // @ts-ignore
      this.store.flows.messages.keys.map((chatId) => {
        this._updateMessagesRead(+chatId);
      })
    }
  }

  private _updateMessagesFlagged(chatId: number): void {
    if (!this.store.flows.messages[chatId].d.length) {
      return;
    }

    const savedMessageIds = this.store.flows.messagesFlagged.d.filter(flagged => flagged.chatId === chatId).map(flagged => flagged.messageId);
    if (savedMessageIds.length) {
      this.store.flows.messages[chatId].d.forEach(message => {
        message.flagged = savedMessageIds.includes(message.id);
      });

      this.store.flows.messages[chatId].v += 1;
    }
  }

  updateMessagesFlagged(chatId?: number): void {
    if (chatId) {
      this._updateMessagesFlagged(chatId);
    } else {
      // @ts-ignore
      this.store.flows.messages.keys.map((chatId) => {
        this._updateMessagesFlagged(+chatId);
      })
    }
  }

  public chatTextParse(text: string) {
    if (!text) return "";
    const {currentUser} = this.store;
    const firstName = currentUser ? currentUser.firstName : "";
    const lastName = currentUser ? currentUser.lastName : "";
    const emojis: { [index: string]: string } = {
      ":)": "🙂",
      ";)": "😉",
      ":d": "😁",
      ":\\": "😕",
      ":/": "😕",
      ":(": "😟",
      "(y)": "👍",
      "(n)": "👎",
    };
    const splitText = text.match(/\S+|\s/g) || [];

    /* copied with modifications from compiled Contriber Flows source */
    const parsedText = [];
    const addText = (text_: string) => parsedText.push(utils.textToHTML(text_));
    for (let i = 0; i < splitText.length; i++) {
      const part = splitText[i];
      if (part === firstName || part === lastName || part[0] === "@" && (part.substr(1) === firstName || part.substr(1) === lastName)) {
        parsedText.push("<span class=\"message-at\">");
        addText(part);
        parsedText.push("</span>");
      } else if (part.match(/^(ftp:\/\/|http:\/\/|https:\/\/|mailto:)(.*)/)) {
        parsedText.push("<a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"");
        addText(part.replace(/"/g, "&quot;"));
        parsedText.push("\">");
        addText(part);
        parsedText.push("</a>");
      } else if (part.match(/^(www.)(.*)/)) {
        parsedText.push("<a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"https://");
        addText(part.replace(/"/g, "&quot;"));
        parsedText.push("\">");
        addText(part);
        parsedText.push("</a>");
      } else if (emojis[part.toLowerCase()]) {
        parsedText.push(emojis[part.toLowerCase()]);
      } else {
        addText(part);
      }
    }
    return parsedText.join("");
  }

  public getMessageTextRepresentation = (messageText: string): string => messageText
  .replace(/<img .*?alt=[\"']?([^\"']*)[\"']?.*?\/?>/g, "$1")
  .replace(/<a .*?href=["']?([^"']*)["']?.*?>(.*)<\/a>/g, "$2")
  .replace(/<(\/p|\/div|\/h\d|br)\w?\/?>/g, "\n")
  .replace(/<[A-Za-z/][^<>]*>/g, "")
  .replace(/&quot/g, "\"");

  public noteTextParse = (text: string): string => text
  .replace(/src=['"]\/files\/*([^'"]+)['"]/g, "src=\"https://flows.contriber.com/files/$1\"")
  .replace(/<a[^<]+href=['"]*([^'"]+)['"][^>]*>/g, "<a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"$1\">")
  .replace(/<p><\/p>/g, "<br>");

  public fileMessagePreviewable = (message: Message): boolean => {
    if (!message.url) return false;
    if (message.originalFileName === "mime") return true;
    let ext: any = message.url.split(".");
    ext = ext[ext.length - 1];
    return ["png", "jpg", "gif", "jpeg", "svg", "mp4"].indexOf(ext.toLowerCase()) >= 0;
  };
}

export default Messages;

type chatFilter = { amount?: number, from?: { id: number }, sticky?: boolean };
