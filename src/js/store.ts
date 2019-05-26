import User from "@/js/model/User";
import Chat from "@/js/model/Chat";
import ChatUser from "@/js/model/ChatUser";
import UserProperty from "@/js/model/UserProperty";

class STORE {
  currentChatId: null | number = null;
  currentChatName: string =  "";
  currentUser: null | User = null;

  loginLoading: boolean = false;
  connectionError: boolean = false;
  errorMsg: string = "";

  modalsOpen: string[] = [];
  route: string = "login";

  flows: StoreFlows = {
    chats: {
      v: 0,
      d: [],
    },
    chatUsers: {
      v: 0,
      d: [],
    },
    users: {
      v: 0,
      d: [],
    },
    userProperties: {
      v: 0,
      d: [],
    },
  };
}

interface StoreFlows {
  chats: { v: number, d: Chat[] };
  chatUsers: { v: number, d: ChatUser[] };
  users: { v: number, d: User[] };
  userProperties: { v: number, d: UserProperty[] };
}

export default STORE;