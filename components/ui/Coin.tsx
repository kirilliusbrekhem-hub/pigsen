/** PigCoin$ mark: the Kapital piggy-$ logo on a brand-green coin. */
export function Coin({ size = 16, label = false }: { size?: number; label?: boolean }) {
  return (
    <span className="pigcoin-wrap">
      <span className="pigcoin" style={{ width: size, height: size }} role="img" aria-label="PigCoin$" />
      {label && <span>PigCoin$</span>}
    </span>
  );
}
