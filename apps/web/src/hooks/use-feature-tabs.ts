import { useState } from "react";

import { featureTabs, type FeatureTabId } from "@/lib/landing/conversations";

export function useFeatureTabs() {
  const [activeId, setActiveId] = useState<FeatureTabId>(featureTabs[0].id);
  const active = featureTabs.find((tab) => tab.id === activeId) ?? featureTabs[0];

  return { tabs: featureTabs, active, select: setActiveId };
}
