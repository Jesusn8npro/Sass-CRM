"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function RedirectWABusiness() {
  const router = useRouter();
  const { idCuenta } = useParams<{ idCuenta: string }>();
  useEffect(() => {
    router.replace(`/app/cuentas/${idCuenta}/whatsapp`);
  }, [idCuenta, router]);
  return null;
}
