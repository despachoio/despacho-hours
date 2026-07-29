"use client";

import { createContext, useContext } from "react";

const RecurringInvoicesEmbeddedContext = createContext(false);

export const RecurringInvoicesEmbeddedProvider = RecurringInvoicesEmbeddedContext.Provider;

export function useRecurringInvoicesEmbedded() {
  return useContext(RecurringInvoicesEmbeddedContext);
}
