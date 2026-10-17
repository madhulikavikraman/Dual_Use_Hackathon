import type { Metadata } from "next";
import { BoardScreen } from "@/components/board/BoardScreen";

export const metadata: Metadata = {
  title: "Supervisor board",
  description: "The overnight supervisor's one screen: zones, the hold, the help registry and the ledger.",
};

export default function BoardPage() {
  return <BoardScreen />;
}
