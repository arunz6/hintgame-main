import { io } from "socket.io-client";
import { serverUrl } from "./api-config";

const socket = io(serverUrl || window.location.origin, {
  autoConnect: false,
  withCredentials: true,
});

export default socket;
