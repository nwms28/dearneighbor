"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "campaign_draft";

export interface LatLng {
  lat: number;
  lng: number;
}

export type DeliveryMethod = "mail" | "download";

export const PER_LETTER_MAILING = 2.99;

export interface ReturnAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CampaignDraft {
  coordinates: LatLng[];
  neighborhoodName: string;
  estimatedCount: number;
  addressCap: number;
  addresses: string[];
  confirmedAddresses: string[];
  generatedLetter: string;
  deliveryMethod: DeliveryMethod;
  returnAddress: ReturnAddress | null;
}

const DEFAULT: CampaignDraft = {
  coordinates: [],
  neighborhoodName: "",
  estimatedCount: 0,
  addressCap: 100,
  addresses: [],
  confirmedAddresses: [],
  generatedLetter: "",
  deliveryMethod: "mail",
  returnAddress: null,
};

function loadFromStorage(): CampaignDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function persist(draft: CampaignDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }
}

export function useCampaignStore() {
  const [draft, setDraftState] = useState<CampaignDraft>(DEFAULT);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setDraftState(loadFromStorage());
  }, []);

  const patch = useCallback((updates: Partial<CampaignDraft>) => {
    setDraftState((prev) => {
      const next = { ...prev, ...updates };
      persist(next);
      return next;
    });
  }, []);

  const clearCampaign = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDraftState(DEFAULT);
  }, []);

  return {
    ...draft,
    mailingCost: draft.confirmedAddresses.length * PER_LETTER_MAILING,
    setCoordinates: (coordinates: LatLng[]) => patch({ coordinates }),
    setNeighborhoodName: (neighborhoodName: string) => patch({ neighborhoodName }),
    setEstimatedCount: (estimatedCount: number) => patch({ estimatedCount }),
    setAddressCap: (addressCap: number) => patch({ addressCap }),
    setAddresses: (addresses: string[]) => patch({ addresses }),
    setConfirmedAddresses: (confirmedAddresses: string[]) => patch({ confirmedAddresses }),
    setGeneratedLetter: (generatedLetter: string) => patch({ generatedLetter }),
    setDeliveryMethod: (deliveryMethod: DeliveryMethod) => patch({ deliveryMethod }),
    setReturnAddress: (returnAddress: ReturnAddress | null) => patch({ returnAddress }),
    clearCampaign,
  };
}
