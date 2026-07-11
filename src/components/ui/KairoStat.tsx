type Props = {
  title: string;
  value: string | number;
};

export default function KairoStat({
  title,
  value,
}: Props) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}