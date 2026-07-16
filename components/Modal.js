"use client";

// Janela flutuante (modal) que aparece por cima de tudo, centralizada,
// independente de onde a página está rolada. Clicar no fundo fecha.
export default function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
