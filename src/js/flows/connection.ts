// @ts-ignore
import autoBind from "auto-bind";
import { Vue } from "vue/types/vue";

import LoginData from "@/js/model/LoginData";
import localstorage from "@/js/flows/localstorage";
import Socket, { OpenResult } from "@/js/socket";


class Connection {
  store: any;
  eventBus: Vue;
  socket: Socket;
  reconnect: boolean = false;

  constructor(store: any, eventBus: Vue) {
    this.store = store;
    this.eventBus = eventBus;

    autoBind(this);
  }

  async login(loginData: LoginData): Promise<boolean> {
    const openResult = await this.openSocket();

    if (openResult.error) return false;
    loginData.clientType = "WEB";
    loginData.clientInfo = "RFlows";

    await this.socket.message("/app/Login.logout", {}, true);
    try {
      await this.socket.message("/app/Login.login", loginData, true);
      return true;
    } catch (error) {
      console.log("loginError", error);
      if (error.body.description !== "You are already logged in. Please logoff or disconnect first (refreshing the page helps)!") {
        this.logout();
      }
    }
    return false;
  }

  logout(): void {
    try {
      if (this.socket && this.socket.connected) {
        this.socket.message("/app/Login.logout", {}, true);
        this.socket.unsubscribeAll();
      }
    } catch (error) {
      console.log("logout error", error);
    } finally {
      localstorage.clearSession();
      this.store.currentUser = null;
    }

    this.eventBus.$emit("logout");
  }

  private async openSocket(): Promise<OpenResult> {
    if (!this.socket) {
      this.socket = new Socket(this.socketFrameHandler, this._socketClose);
    }
    try {
      const result: OpenResult = await this.socket.open();
      if (result.error) return result;
      await Promise.all([
        this.socket.subscribe("/user/queue/response"),
        this.socket.subscribe("/topic/common"),
      ]);
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

    console.log(frame);
    this.store.connectionError = false;
    switch (type) {
      case "LoginResponse": {
        localstorage.setSessionToken(frameBody.token);
        localstorage.setSessionUser(frameBody.user);
        if (frameBody.user) this.store.currentUser = frameBody.user;
        break;
      }
      case "Error": {
        this.store.errorMsg = frameBody.description;
        this.store.connectionError = true;
      }
      default: {
        console.log("Unknown frame type " + type);
        //console.log(frame);
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

export default Connection;
