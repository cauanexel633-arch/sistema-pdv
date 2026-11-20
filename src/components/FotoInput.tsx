import { useEffect, useRef, useState, type ChangeEvent } from 'react';

interface Props {
  rotulo: string;
  arquivo: File | null;
  onChange: (arquivo: File | null) => void;
}

export default function FotoInput({ rotulo, arquivo, onChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const refCamera = useRef<HTMLInputElement>(null);
  const refGaleria = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!arquivo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  function quandoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (f) onChange(f);
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3">
      <p className="rotulo">{rotulo} *</p>
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="" className="h-20 w-20 flex-none rounded-lg object-cover" />
        ) : (
          <div className="flex h-20 w-20 flex-none items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-400">
            🖼️
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <button type="button" className="btn-secundario" onClick={() => refCamera.current?.click()}>
            📸 Câmera
          </button>
          <button type="button" className="btn-secundario" onClick={() => refGaleria.current?.click()}>
            🖼 Galeria
          </button>
          {arquivo && (
            <button type="button" className="text-sm text-red-600 underline" onClick={() => onChange(null)}>
              Remover foto
            </button>
          )}
        </div>
      </div>
      <input ref={refCamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={quandoEscolher} />
      <input ref={refGaleria} type="file" accept="image/*" className="hidden" onChange={quandoEscolher} />
    </div>
  );
}
