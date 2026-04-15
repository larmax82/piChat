import { useStore } from "@/store";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { Toolbar } from "@/components/chat/Toolbar";

export function ChatCanvas() {
  const messages = useStore((s) => s.messages);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <Toolbar />
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-zinc-500">
              <h2 className="mb-2 text-xl font-light">piChat</h2>
              <p className="text-sm">Send a message to start a conversation</p>
            </div>
          </div>
        ) : (
          <MessageList />
        )}
      </div>
      <ChatInput />
    </div>
  );
}
