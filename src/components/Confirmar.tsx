import Modal from './Modal';

interface Props {
  mensagem: string;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function Confirmar({ mensagem, carregando = false, onConfirmar, onCancelar }: Props) {
  return (
    <Modal titulo="Confirmar ação" onFechar={onCancelar}>
      <p className="text-base text-slate-700">{mensagem}</p>
      <div className="mt-6 flex gap-3">
        <button className="btn-secundario flex-1" onClick={onCancelar} disabled={carregando}>
          Cancelar
        </button>
        <button className="btn-perigo flex-1" onClick={onConfirmar} disabled={carregando}>
          {carregando ? 'Aguarde…' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}
