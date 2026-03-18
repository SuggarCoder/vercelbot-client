"use client";

import { getSuggestions as getCentralSuggestions } from "@/lib/central/client";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const suggestions = await getCentralSuggestions(documentId);
  return suggestions ?? [];
}
