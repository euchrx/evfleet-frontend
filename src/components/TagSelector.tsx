type Tag = {
  id: string;
  name: string;
};

type Props = {
  selected: string[];
  onChange: (ids: string[]) => void;
};

const tags: Tag[] = [
  { id: '1', name: 'Atendimento' },
  { id: '2', name: 'Rapidez' },
  { id: '3', name: 'Limpeza' },
  { id: '4', name: 'Produto' },
  { id: '5', name: 'Ambiente' },
];

export default function TagSelector({ selected, onChange }: Props) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((i) => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10">
      {tags.map((tag) => {
        const active = selected.includes(tag.id);

        return (
          <button
            key={tag.id}
            onClick={() => toggle(tag.id)}
            className={`rounded-2xl p-4 text-center border transition active:scale-95 ${
              active
                ? 'bg-sky-500 border-sky-400 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}