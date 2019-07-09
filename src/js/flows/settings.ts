// @ts-ignore
import autoBind from "auto-bind";
import { Vue } from "vue/types/vue";

import Flows2 from "@/js/flows/main";
import STORE from "@/js/store";
import UserProperty from "@/js/model/UserProperty";
import { FrameAction } from "@/js/flows/connection";

class Settings {
  flows: Flows2;
  store: STORE;
  events: Vue;

  constructor(flows: Flows2) {
    this.flows = flows;
    this.store = flows.store;
    this.events = flows.events;

    autoBind(this);
  }

  getBooleanUserProp(property: BooleanUserProperty): boolean {
    const prop = this.store.flows.userProperties.d.find(userProperty => userProperty.name === property);
    if (prop) return prop.value;
    switch (property) {
      case "autoMarkAsRead":
      case "showWorkspaceSwitcher":
        return true;
      default:
        return false;
    }
  }

  setBooleanUserProp(property: BooleanUserProperty, value: boolean): void {
    if (!this.store.currentUser) throw new Error("No currentUser in store");
    const currentUserId = this.store.currentUser.id;

    let prop = this.store.flows.userProperties.d.find(userProperty => userProperty.name === property)
      || {
        name: property,
        value: null,
        id: null,
        userId: currentUserId,
        orgId: null,
      };
    prop.value = value;
    try {
      this.flows.connection.message("/app/UserProperty.save", prop);
    } catch (error) {
      console.log(error);
      this.events.$emit("notify", `Error saving ${property}`);
    }
  }

  getNumberUserProp(property: NumberUserProperty): number {
    const prop = this.store.flows.userProperties.d.find(userProperty => userProperty.name === property);
    if (prop) return prop.value;
    switch (property) {
      default:
        return 0;
    }
  }

  setNumberUserProp(property: NumberUserProperty, value: number): void {
    if (!this.store.currentUser) throw new Error("No currentUser in store");
    const currentUserId = this.store.currentUser.id;

    let prop = this.store.flows.userProperties.d.find(userProperty => userProperty.name === property)
      || {
        name: property,
        value: null,
        id: null,
        userId: currentUserId,
        orgId: null,
      };
    prop.value = value;
    try {
      this.flows.connection.message("/app/UserProperty.save", prop);
    } catch (error) {
      console.warn(error);
      this.events.$emit("notify", `Error saving ${property}`);
    }
  }

  async getSettings(): Promise<void> {
    this.flows.connection.subscribeUserTopic("UserProperty");
    await Promise.all([
      this.flows.connection.findByUser("UserProperty"),
    ]);
  }

  parseSettings(settings: any[], action: FrameAction) {
    if (action === "deleted") {
      this.flows.deleteStoreArrayItems("userProperties", settings);
      return;
    }
    this.flows.updateStoreArray("userProperties", settings.map(Settings.mapProperty));

    if (this.getBooleanUserProp("desktopNotifications") && Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (this.store.currentChatId === null) {
      if (this.flows.chats.recentChatIds.length) {
        this.store.currentChatId = this.flows.chats.recentChatIds[0];
      }
    }
  }

  private static mapProperty(property: any): UserProperty {
    return {
      id: property.id,
      name: property.name,
      value: property.value,
    };
  }
}

export default Settings;

type BooleanUserProperty = ("autoMarkAsRead" | "desktopNotifications" | "showWorkspaceSwitcher" | "compactMode");
type NumberUserProperty = ("lastNotifiedMessageId");
