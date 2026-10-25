import type { Metadata } from "next";

import { DemoChat } from "@/components/demo/demo-chat";

export const metadata: Metadata = {
  title: "Try Thya",
  description: "Chat with Thya about a sample coffee shop's sales.",
};

export default function DemoPage() {
  return <DemoChat />;
}
