import type { ClientMessage, ServerMessage } from '@chispa/protocol';

export function createSocket(onMessage: (message: ServerMessage) => void, onStatus: (connected: boolean) => void) {
  let socket: WebSocket | undefined;
  let retry: number | undefined;
  let manuallyClosed = false;

  const connect = () => {
    const configured = import.meta.env.VITE_WS_URL as string | undefined;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = configured ?? `${protocol}//${window.location.host}/socket`;
    socket = new WebSocket(url);
    socket.addEventListener('open', () => onStatus(true));
    socket.addEventListener('message', (event) => {
      try {
        onMessage(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        // A malformed server frame is ignored; the next snapshot restores the UI.
      }
    });
    socket.addEventListener('close', () => {
      onStatus(false);
      if (!manuallyClosed) retry = window.setTimeout(connect, 1_000);
    });
  };

  connect();
  return {
    send(message: ClientMessage) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    reconnect() {
      manuallyClosed = false;
      socket?.close();
    },
    close() {
      manuallyClosed = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    }
  };
}
