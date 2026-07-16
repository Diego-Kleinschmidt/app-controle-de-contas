"use client";

// Janela flutuante (modal) que aparece por cima de tudo, centralizada,
// independente de onde a página está rolada.
// IMPORTANTE: NÃO fecha ao tocar no fundo — só pelos botões (Cancelar/Fechar).
// Assim um toque errado do lado de fora não faz perder o que foi digitado.
export default function Modal({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-6 w-full max-w-md">{children}</div>
    </div>
  );
}
