export function ControlsHud() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        padding: '10px 14px',
        background: 'rgba(20, 30, 40, 0.55)',
        color: 'white',
        borderRadius: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
        lineHeight: 1.7,
        pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
      }}
    >
      <div>
        <kbd>1</kbd> Dad &nbsp; <kbd>2</kbd> Penny &nbsp; <kbd>3</kbd> Luke
      </div>
      <div>
        <kbd>WASD</kbd> move &nbsp; <kbd>⇧</kbd> run &nbsp; <kbd>␣</kbd> jump
      </div>
      <div>
        <kbd>E</kbd> open / close door &nbsp; <kbd>R</kbd> reset
      </div>
      <div>
        <kbd>click</kbd> look around &nbsp; <kbd>esc</kbd> release cursor
      </div>
    </div>
  );
}
