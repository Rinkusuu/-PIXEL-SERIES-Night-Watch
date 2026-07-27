import type { ReactNode } from 'react';

type Props = {
  title: string;
  index: number;
  /** Cards holding fine controls must NOT float — DNA §8.5. */
  float?: boolean;
  spark?: boolean;
  tools?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, index, float = false, spark = true, tools, className = '', children }: Props) {
  // Periods spread over co-prime cycles and negative phase offsets, so no two
  // cards ever float in step. DNA §8.5.
  const style = {
    ['--i' as string]: index,
    ['--float-dur' as string]: `${6.2 + (index % 5) * 0.9}s`,
    ['--float-delay' as string]: `${(index % 7) * -0.73}s`,
  };

  return (
    <section className={`panel ${float ? 'panel--float' : ''} ${className}`} style={style}>
      <header className="panel__head">
        {spark && <span className="panel__spark" />}
        <h2 className="panel__title">{title}</h2>
        {tools && <div className="panel__tools">{tools}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
