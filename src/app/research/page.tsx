import type { Metadata } from "next";
import { ThesisWorkspace } from "@/components/research/thesis-workspace";

export const metadata: Metadata = {
  title: "Research Workspace",
  description: "Build and revise evidence-linked investment theses locally in your browser.",
};

export default function ResearchPage() {
  return <ThesisWorkspace />;
}
