export function Filter() {
  return (
    <div className="mb-4">
      <div className="bg-secondary shadow-lg rounded-lg p-4 mb-2">
        <input
          type="text"
          placeholder="Search room..."
          className="w-full bg-primary-muted p-2 rounded-lg text-white"
        />
        <div className="flex items-center mt-2">
          <span className="text-white mr-2">Доступны:</span>
          <input type="range" min="0" max="1" className="w-1/2" />
        </div>
        <button className="bg-button-fill text-white px-4 py-2 rounded-lg mt-2">Фильтры</button>
      </div>
      {/* Slide-down panel (hidden by default) */}
      <div className="hidden bg-secondary shadow-lg rounded-lg p-4 mt-2 transition-transform duration-300 ease-out transform translate-y-full">
        <p>Range: 0 - 1M USDT</p>
      </div>
    </div>
  );
}
