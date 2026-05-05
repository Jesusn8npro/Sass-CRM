"use client";

import { type ReactNode } from "react";
import { Toaster } from "./Toaster";
import { ConfirmDialogProvider } from "./ConfirmDialog";

/**
 * Wrapper único de providers UI globales (toasts + confirm dialog).
 * Va en el root layout para que cualquier client component pueda usar
 * `useToast()` y `useConfirm()` sin re-importar providers.
 */
export function ProveedoresUI({ children }: { children: ReactNode }) {
  return (
    <Toaster>
      <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
    </Toaster>
  );
}
