// @ts-ignore
import autoBind from "auto-bind";
import { Vue } from "vue/types/vue";

import Flows2 from "@/js/flows/main";
import STORE from "@/js/store";
import LoginData from "@/js/model/LoginData";
import localstorage from "@/js/flows/localstorage";
import Socket, { OpenResult, SocketResult, SubResult } from "@/js/socket";


class Connection {
  flows: Flows2;
  store: STORE;
  events: Vue;
  socket: Socket;
  reconnect: boolean = false;

  constructor(flows: Flows2) {
    this.flows = flows;
    this.store = flows.store;
    this.events = flows.events;

    autoBind(this);
  }

  public message(destination: string, data: Object): void {
    if (!this.canMessage) throw new Error("Can not message, socket closed");
    this.socket.message(destination, data);
  }

  public messageWithResponse(destination: string, data: Object): Promise<SocketResult> {
    if (!this.canMessage) return Promise.reject(new Error("Can not message, socket closed"));
    // @ts-ignore
    return this.socket.message(destination, data, true);
  }

  public async findByUser(topic: GlobalUserTopic) {
    if (!this.canMessageAuth) return Promise.reject(new Error("Not connected / signed in"));
    // @ts-ignore
    const currentUserId = this.store.currentUser.id;
    return await this.messageWithResponse(`/app/${topic}.findByUser`, { id: currentUserId });
  }

  public async findByChat(topic: ChatTopic, id: number, filter?: any) {
    return await this.messageWithResponse(`/app/${topic}.findByTopic`, filter ? {id, filter} : {id});
  }

  public subscribe(destination: string): void {
    this.socket.subscribe(destination);
  }

  public subscribeWithResponse(destination: string): Promise<SubResult> {
    // @ts-ignore
    return this.socket.subscribe(destination, true);
  }

  public subscribeUserTopic(topic: GlobalUserTopic): Promise<SubResult[]> {
    if (!this.canMessageAuth) return Promise.reject(new Error("Not connected / signed in"));
    // @ts-ignore
    const currentUserId = this.store.currentUser.id;
    const promises = ["modified", "deleted"].map(type => this.subscribeWithResponse(`/topic/User.${currentUserId}.${topic}.${type}`));
    return Promise.all(promises);
  }

  public subscribeChatTopic(topic: ChatTopic, id: number): Promise<SubResult[]> {
    const promises = ["modified", "deleted"].map(type => this.subscribeWithResponse(`/topic/Topic.${id}.${topic}.${type}`));
    return Promise.all(promises);
  }

  get canMessage(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  get canMessageAuth(): boolean {
    return !!(this.canMessage && this.store.currentUser);
  }

  async login(loginData: LoginData): Promise<boolean> {
    const result = await (async () => {
      const openResult = await this.openSocket();

      if (openResult.error) return false;
      loginData.clientType = "WEB";
      loginData.clientInfo = "RFlows";

      try {
        await this.messageWithResponse("/app/Login.logout", {});
        await this.messageWithResponse("/app/Login.login", loginData);
        return true;
      } catch (error) {
        console.log("loginError", error);
        if (error.body.description !== "You are already logged in. Please logoff or disconnect first (refreshing the page helps)!") {
          this.logout();
        }
      }
      return false;
    })();

    if (result === true) this.events.$emit("loginDone");
    return result;

  }

  logout(): void {
    try {
      if (this.canMessage) {
        this.messageWithResponse("/app/Login.logout", {});
        this.socket.unsubscribeAll();
      }
    } catch (error) {
      console.log("logout error", error);
    } finally {
      localstorage.clearSession();
      this.store.currentUser = null;
      this.store.currentChatId = null;
      Object.keys(this.store.flows).forEach(key => {
        if (key === "_messages") return;
        if (key === "messages") {
          // @ts-ignore
          this.store.flows.messages.keys.forEach(chatId => {
            this.store.flows.messages[chatId].d = [];
            this.store.flows.messages[chatId].v += 1;
          });
          return;
        }
        // @ts-ignore
        this.store.flows[key].d = [];
        // @ts-ignore
        this.store.flows[key].v += 1;
      });
    }

    this.events.$emit("logout");
  }

  private async openSocket(): Promise<OpenResult> {
    if (!this.socket) {
      this.socket = new Socket(this.socketFrameHandler, this._socketClose);
    }
    try {
      const result: OpenResult = await this.socket.open();
      if (result.error) return result;
      this.subscribe("/user/queue/response");
      this.subscribe("/topic/common");
      this.reconnect = true;
      return result;

    } catch (errorData) {
      return errorData;
    }
  }

  private socketFrameHandler(frame: any): void {
    const frameType = frame.headers.cl;
    const type = frameType.replace("[]", "");
    const frameBody = JSON.parse(frame.body);
    const frameDestination = frame.headers.destination.split(".");

    let action = frame.headers.destination.match(/\.(modified|deleted)$/);
    if (action && action.length > 1) action = action[1];
    //console.log(type, action, frameBody.length);

    this.store.connectionError = false;
    switch (type) {
      case "LoginResponse": {
        localstorage.setSessionToken(frameBody.token);
        localstorage.setSessionUser(frameBody.user);
        if (frameBody.user) this.store.currentUser = frameBody.user;
        break;
      }
      case "Topic": {
        this.flows.chats.parseChats(Connection.bodyFilter(frameBody));
        break;
      }
      case "TopicUser": {
        this.flows.chats.parseChatUsers(Connection.bodyFilter(frameBody));
        break;
      }
      case "Organization": {
        this.flows.chats.parseWorkspaces(Connection.bodyFilter(frameBody));
        break;
      }
      case "TopicLocation": {
        this.flows.chats.parseChatWorkspaces(Connection.bodyFilter(frameBody));
        break;
      }
      case "TopicItem": {
        this.flows.chats.parseChatMessages(Connection.bodyFilter(frameBody));
        break;
      }
      case "TopicItemRead": {
        this.flows.chats.parseChatMessagesRead(Connection.bodyFilter(frameBody));
        break;
      }
      case "TopicItemUserProperty": {
        this.flows.chats.parseChatMessagesFlagged(Connection.bodyFilter(frameBody));
        break;
      }
      case "UserAccess": {
        this.flows.chats.parseChatWorkspaceAccesses(Connection.bodyFilter(frameBody));
        break;
      }
      case "User": {
        this.flows.users.parseUsers(Connection.bodyFilter(frameBody));
        break;
      }
      case "UserProperty": {
        this.flows.settings.parseSettings(Connection.bodyFilter(frameBody));
        break;
      }
      case "Error": {
        this.store.errorMsg = frameBody.description;
        this.store.connectionError = true;
        break;
      }
      case "SubscribeResponse": {
        break;
      }
      default: {
        console.log("Unknown frame type " + type);
        console.log(frame);
      }
    }
    /*
    if (frameDestination[frameDestination.length - 1] === "deleted") {
      const itemIndex = this.store.topics[frameType].findIndex(item => item.id === parseInt(frameBody.id, 10));
      this._debug("Delete", frameType, frameBody);
      if (itemIndex > -1) {
        Vue.delete(this.store.topics[frameType], itemIndex);
      }
    }

    if (["ServerInfo", "SubscribeResponse"].indexOf(frameType) > -1) return;
    if (frameType === "LoginResponse") {
      if (frameBody.token) {
        localStorage.setItem("session", JSON.stringify({ token: frameBody.token }));
      }
      frameBody.user ? this._debug(`log in ${frameBody.user.email}`) : this._debug("log out");
      return;
    }

    if (ALL_TOPICS.map(t => `${t}[]`).indexOf(frameType) > -1) {
      if (this.store.topics[type]) {
        const newIds = frameBody.map(o => o.id);
        Vue.set(this.store.topics, type, this.store.topics[type].filter(o => newIds.indexOf(o.id) < 0).concat(frameBody));
      } else {
        Vue.set(this.store.topics, type, frameBody);
      }
    } else if (ALL_TOPICS.indexOf(frameType) > -1) {
      const old = this.store.topics[frameType]
        ? this.store.topics[frameType].find(topic => topic.id === frameBody.id)
        : false;
      if (old) {
        const index = this.store.topics[frameType].indexOf(old);
        Vue.set(this.store.topics[frameType], index, frameBody);
      } else {
        if (!this.store.topics[frameType]) Vue.set(this.store.topics, frameType, []);
        this.store.topics[frameType].push(frameBody);
      }
    } else if (frameType === "Error") {
      this._debug("! Socket error", frameBody);
      if (frameBody.description) this.$events.$emit("notify", frameBody.description);
    } else {
      this._debug(`! UNHANDLED MESSAGE: ${frameType}`, frame.headers, frameBody);
    }

    if (["TopicItem", "TopicItemRead", "TopicItemUserProperty", "TopicUser"].indexOf(type) > -1) {
      this.store.lastUpdateChat = frame.headers["message-id"];

      if (type === "TopicItem" && !frame.headers["response-id"]) {
        if (typeof frameBody === "object" && !frameBody.deleted && frameBody.creatorUserId !== this.store.currentUser.id) {
          this._messageNotification(frameBody);
        }
      }
    }*/
  }

  private static makeArrayIfNotArray(x: any): any[] {
    if (x.length === undefined) {
      x = [x];
    }
    return x;
  }

  private static removeDeleted(x: any[]): any[] {
    return x.filter(a => !a.deleted);
  }

  private static bodyFilter(x: any): any[] {
    return Connection.removeDeleted(Connection.makeArrayIfNotArray(x));
  }

  private _socketClose(CloseEvent: any): void {
    console.log("Close", CloseEvent);
    /*this.store.connectionError = true;

    this._debug("", CloseEvent);
    if (this.store.loginLoading) {
      this._debug("! Socket closed while logging in");
      this.store.loginLoading = false;
      this.store.connectionError = true;
    }

    if (!CloseEvent) {
      this._debug("No CloseEvent");
      this.store.errorMsg = "Socket closed";
      return;
    }

    if ([1000, 1002, 1006].indexOf(CloseEvent.code) > -1) {
      this.startReconnectTimer();
    }
    if (CloseEvent.reason?.length) {
      this.store.errorMsg = CloseEvent.reason;
    } else if (CloseEvent.code && CloseEvent.code === 1006) {
      this.store.errorMsg = "Connection lost";
    }*/
  }
}

type GlobalUserTopic = ("TopicUser" | "UserProperty" | "Topic" | "Organization" | "TopicLocation" | "User" | "OrganizationContact" | "UserAccess");
type ChatTopic = ("TopicItem" | "TopicUser" | "TopicItemUserProperty" | "TopicItemRead");

export default Connection;
