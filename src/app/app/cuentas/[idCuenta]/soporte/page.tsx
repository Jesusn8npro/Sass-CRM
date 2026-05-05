import { ChatSoporte } from "./_componentes/ChatSoporte";

interface Props {
  params: Promise<{ idCuenta: string }>;
}

export default async function PaginaSoporte({ params }: Props) {
  const { idCuenta } = await params;
  return <ChatSoporte idCuenta={idCuenta} />;
}
