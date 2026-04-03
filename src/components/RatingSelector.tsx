type Props = {
  onSelect: (rating: number) => void;
};

const options = [
  { value: 1, emoji: '😡', label: 'Péssimo' },
  { value: 2, emoji: '😐', label: 'Ruim' },
  { value: 3, emoji: '🙂', label: 'Ok' },
  { value: 4, emoji: '😃', label: 'Bom' },
  { value: 5, emoji: '🤩', label: 'Excelente' },
];

export default function RatingSelector({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="bg-slate-800 hover:bg-slate-700 transition rounded-2xl p-6 flex flex-col items-center justify-center active:scale-95"
        >
          <span className="text-4xl md:text-5xl">{opt.emoji}</span>
          <span className="mt-2 text-sm md:text-base text-slate-300">
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}