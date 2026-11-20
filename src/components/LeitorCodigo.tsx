import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Modal from './Modal';

const ELEMENTO_ID = 'leitor-codigo-barras';

interface Props {
  onLido: (codigo: string) => void;
  onFechar: () => void;
}

/** Abre a câmera traseira e devolve o primeiro código de barras lido. */
export default function LeitorCodigo({ onLido, onFechar }: Props) {
  const [erro, setErro] = useState('');
  const jaLidoRef = useRef(false);
  const onLidoRef = useRef(onLido);
  onLidoRef.current = onLido;

  useEffect(() => {
    let ativo = true;
    const leitor = new Html5Qrcode(ELEMENTO_ID);

    leitor
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 140 } },
        (texto) => {
          if (jaLidoRef.current || !ativo) return;
          jaLidoRef.current = true;
          onLidoRef.current(texto.trim());
        },
        () => {
          /* quadros sem código: ignorar */
        },
      )
      .catch(() => {
        if (ativo) {
          setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador ou use o leitor USB.');
        }
      });

    return () => {
      ativo = false;
      leitor
        .stop()
        .catch(() => {})
        .finally(() => {
          try {
            leitor.clear();
          } catch {
            /* já limpo */
          }
        });
    };
  }, []);

  return (
    <Modal titulo="Ler código de barras" onFechar={onFechar}>
      <div id={ELEMENTO_ID} className="overflow-hidden rounded-xl bg-black" />
      {erro ? (
        <p className="mt-3 text-sm text-red-700">{erro}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Aponte a câmera para o código de barras do kit.</p>
      )}
    </Modal>
  );
}
